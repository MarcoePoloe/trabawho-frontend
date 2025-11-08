// screens/Employer/ApplicantDetailScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as DocumentPicker from "expo-document-picker";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import {
  getRequest,
  postRequest,
  deleteRequest,
  putForm,
} from "../../services/api";
import DateTimePicker from "@react-native-community/datetimepicker";

// ✅ Shared color + label utilities
const getStatusColor = (status) => {
  switch ((status || "").toLowerCase()) {
    case "submitted":
      return "#6c757d";
    case "viewed":
      return "#5271ff";
    case "under_review":
      return "#ffb84d";
    case "interview_scheduled":
      return "#17a2b8";
    case "accepted":
      return "#28a745";
    case "rejected":
      return "#dc3545";
    default:
      return "#adb5bd";
  }
};

const formatStatusLabel = (status) => {
  if (!status) return "Submitted";
  const normalized = status.replace(/_/g, " ").trim().toLowerCase();
  if (normalized === "interview scheduled") return "Interview";
  return normalized
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};


const Badge = ({ status }) => (
  <View
    style={[
      styles.statusBadge,
      { backgroundColor: getStatusColor(status) },
    ]}
  >
    <Text style={styles.statusText}>{formatStatusLabel(status)}</Text>
  </View>
);


const ApplicantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { application } = route.params;
  const application_id = application?.application_id;

  const [details, setDetails] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(null);

  const [pinLoading, setPinLoading] = useState(false);
  const [pinned, setPinned] = useState(application?.is_pinned || false);

  const [updatingUnderReview, setUpdatingUnderReview] = useState(false);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [interviewType, setInterviewType] = useState("online");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);




  // Verdict Modal
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [verdictStatus, setVerdictStatus] = useState("accepted");
  const [verdictMessage, setVerdictMessage] = useState("");
  const [verdictDoc, setVerdictDoc] = useState(null);
  const [submittingVerdict, setSubmittingVerdict] = useState(false);
  const [verdict, setVerdict] = useState(null);

  const currentStatus = useMemo(() => {
    return details?.status || application?.status || "submitted";
  }, [details, application]);

  // ─────────────── Fetchers ───────────────
  const fetchDetails = async () => {
    try {
      const res = await getRequest(`/applications/${application_id}/details`);
      setDetails(res?.data || null);
      if (res?.data?.is_pinned !== undefined) {
        setPinned(!!res.data.is_pinned);
      }
    } catch (err) {
      console.error("❌ Error fetching application details:", err);
      setDetails(null);
    }
  };

  const fetchVerdict = async () => {
  try {
    const res = await getRequest(`/applications/${application_id}/verdict`);
    const data = res?.data?.verdict;

    if (data) {
      setVerdict({
        status: data.status || null,
        verdict_message: data.verdict_message || "",
        verdict_doc: data.verdict_doc || null,
        verdict_at: data.verdict_at || null,
      });
    } else {
      setVerdict(null);
    }
  } catch (err) {
    console.error("❌ Error fetching verdict:", err);
    setVerdict(null);
  }
};
// 📅 Combined Date + Time Picker Logic
const handlePickDateTime = () => {
  setShowDatePicker(true);
};

// 📅 Render the Date + Time Pickers
const renderDateTimePickers = () => (
  <>
    {showDatePicker && (
      <DateTimePicker
        value={scheduledAt ? new Date(scheduledAt) : new Date()}
        mode="date"
        display="default"
        minimumDate={new Date()}
        onChange={(event, selectedDate) => {
          setShowDatePicker(false);
          if (selectedDate) {
            setTempDate(selectedDate);

            // Open Time Picker after selecting date
            setTimeout(() => {
              setShowTimePicker(true);
            }, 250);
          }
        }}
      />
    )}

    {showTimePicker && (
      <DateTimePicker
        value={tempDate || new Date()}
        mode="time"
        is24Hour={true}
        display="default"
        onChange={(event, selectedTime) => {
          setShowTimePicker(false);
          if (selectedTime) {
            const combined = new Date(tempDate || new Date());
            combined.setHours(selectedTime.getHours());
            combined.setMinutes(selectedTime.getMinutes());
            combined.setSeconds(0);

            // Convert to proper ISO format (UTC with trailing 'Z')
            const utcISO = combined.toISOString().replace(/\.\d{3}Z$/, "Z");
            setScheduledAt(utcISO);
          }
        }}
      />
    )}
  </>
);
  // ================== 📅 Schedule Interview Function ==================
const handleScheduleInterview = async () => {
  // Validation checks
  if (!scheduledAt) {
    Alert.alert("Missing Date/Time", "Please select a valid interview date and time.");
    return;
  }
  if (!["online", "on_site"].includes(interviewType)) {
    Alert.alert("Invalid Type", "Interview type must be either 'online' or 'on_site'.");
    return;
  }
  if (interviewType === "online" && !link) {
    Alert.alert("Missing Link", "Please provide the video meeting link for online interviews.");
    return;
  }
  if (interviewType === "on_site" && !location) {
    Alert.alert("Missing Location", "Please provide the physical location for on-site interviews.");
    return;
  }

  try {
    setScheduling(true);

    const form = new URLSearchParams();
    form.append("interview_type", interviewType);
    form.append("scheduled_at", scheduledAt); // Example: 2025-11-08T23:00:00Z

    if (interviewType === "online") form.append("link", link);
    else form.append("location", location);

    if (notes) form.append("details", notes);

    await postRequest(`/interviews/${application_id}`, form);

    Alert.alert("Success", "Interview scheduled successfully!");
    setShowScheduleModal(false);

    // Reset modal fields
    setInterviewType("online");
    setScheduledAt("");
    setLocation("");
    setLink("");
    setNotes("");

    // Refresh data
    await Promise.all([fetchTimeline(), fetchInterviews(), fetchDetails()]);
  } catch (err) {
    console.error("❌ Schedule interview failed:", err);
    Alert.alert("Error", err?.response?.data?.detail || "Failed to schedule interview.");
  } finally {
    setScheduling(false);
  }
};


  const fetchTimeline = async () => {
    try {
      const res = await getRequest(`/applications/${application_id}/progress`);
      setTimeline(res?.data?.timeline || []);
    } catch (err) {
      console.error("❌ Error fetching timeline:", err);
      setTimeline([]);
    }
  };

  const fetchInterviews = async () => {
    try {
      const res = await getRequest(`/interviews/${application_id}`);
      setInterviews(res?.data?.interviews || []);
    } catch (err) {
      console.error("❌ Error fetching interviews:", err);
      setInterviews([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchDetails(), fetchTimeline(), fetchInterviews(), fetchVerdict()]);
    setLoading(false);
  };

  useEffect(() => {
    if (!application_id) return;
    loadAll();
  }, [application_id]);

  // ─────────────── Actions ───────────────
  const openDoc = async (url, docKind) => {
    if (!url) {
      Alert.alert("Document not available");
      return;
    }
    try {
      if (docKind === "resume" && currentStatus === "submitted") {
        const data = new URLSearchParams();
        await putForm(`/applications/${application_id}/viewed`, data);
        await Promise.all([fetchTimeline(), fetchDetails()]);
      }
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      console.error("❌ Failed to open doc:", e);
      Alert.alert("Error", "Could not open document");
    }
  };

  const handleTogglePin = async () => {
    if (!application_id) return;
    try {
      setPinLoading(true);
      if (pinned) {
        await deleteRequest(`/applications/${application_id}/pin`);
        setPinned(false);
      } else {
        await postRequest(`/applications/${application_id}/pin`);
        setPinned(true);
      }
    } catch (err) {
      console.error("❌ Toggle pin failed:", err);
      Alert.alert("Error", "Could not update pinned status");
    } finally {
      setPinLoading(false);
    }
  };

  const handleUnderReview = async () => {
    if (!application_id) return;
    try {
      setUpdatingUnderReview(true);
      const data = new URLSearchParams();
      await putForm(`/applications/${application_id}/under-review`, data);
      Alert.alert("Updated", "Application marked as Under Review.");
      await Promise.all([fetchDetails(), fetchTimeline()]);
    } catch (err) {
      console.error("❌ Under review update failed:", err);
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "Failed to mark as under review"
      );
    } finally {
      setUpdatingUnderReview(false);
    }
  };

  // 📄 Document Picker for verdict
  const pickVerdictDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!res.canceled) setVerdictDoc(res.assets[0]);
    } catch (err) {
      console.error("❌ Document picker error:", err);
      Alert.alert("Error", "Failed to select document.");
    }
  };

  // 📤 Submit Verdict
  const handleSubmitVerdict = async () => {
    if (!verdictStatus) {
      Alert.alert("Missing Status", "Please select Accepted or Rejected.");
      return;
    }

    try {
      setSubmittingVerdict(true);
      const formData = new FormData();
      formData.append("status", verdictStatus);
      if (verdictMessage.trim())
        formData.append("verdict_message", verdictMessage.trim());
      if (verdictDoc) {
        formData.append("verdict_doc", {
          uri: verdictDoc.uri,
          name: verdictDoc.name,
          type: "application/pdf",
        });
      }

      await putForm(
        `/applications/${application_id}/status`,
        formData,
        true
      );

      Alert.alert("Success", "Verdict submitted successfully.");
      setShowVerdictModal(false);
      setVerdictMessage("");
      setVerdictDoc(null);
      await Promise.all([fetchDetails(), fetchTimeline()]);
    } catch (err) {
      console.error("❌ Verdict submit error:", err);
      Alert.alert("Error", "Failed to submit verdict.");
    } finally {
      setSubmittingVerdict(false);
    }
  };

  // ─────────────── UI ───────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A6FA5" />
        <Text style={styles.loadingText}>Loading applicant & job...</Text>
      </View>
    );
  }

  if (!details?.job) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={24} color="#d32f2f" />
        <Text style={styles.errorText}>Failed to load details.</Text>
      </View>
    );
  }

  const { job, resume_url, cover_letter_url, applicant } = details;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {/* Job Header */}
        <View style={styles.header}>
          <Text style={styles.jobTitle}>{job?.title}</Text>
          <Text style={styles.company}>{job?.company}</Text>
          <Text style={styles.location}>{job?.location}</Text>

          {/* Pin + Status */}
          <View style={styles.statusPinRow}>
            <TouchableOpacity
              style={[styles.pinButton, pinned && styles.pinButtonActive]}
              onPress={handleTogglePin}
              disabled={pinLoading}
            >
              {pinLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={pinned ? "bookmark" : "bookmark-outline"}
                    size={18}
                    color={pinned ? "#fff" : "#4A6FA5"}
                  />
                  <Text style={[styles.pinText, pinned && { color: "#fff" }]}>
                    {pinned ? "Pinned" : "Pin"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Badge status={currentStatus} />
          </View>

          <Text style={styles.date}>
            Applied on:{" "}
            {new Date(
              details?.applied_at || application?.applied_at
            ).toLocaleDateString()}
          </Text>
        </View>

        {/* Applicant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant</Text>

         

          <TouchableOpacity
              onPress={() => navigation.navigate('ProfileDetail', { user_id: applicant?.job_seeker_id, })}
          >
            <Text style={[styles.bodyText, { color: "#4A6FA5", textDecorationLine: "underline" }]}>
              {applicant?.name} • {applicant?.email}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <TouchableOpacity
            style={styles.documentButton}
            onPress={() =>
              openDoc(resume_url?.signedURL || resume_url?.signedUrl, "resume")
            }
          >
            <MaterialIcons name="description" size={20} color="#fff" />
            <Text style={styles.documentButtonText}>View Resume</Text>
          </TouchableOpacity>
          {cover_letter_url?.signedURL && (
            <TouchableOpacity
              style={styles.documentButton}
              onPress={() =>
                openDoc(
                  cover_letter_url?.signedURL || cover_letter_url?.signedUrl,
                  "cover"
                )
              }
            >
              <MaterialIcons name="description" size={20} color="#fff" />
              <Text style={styles.documentButtonText}>View Cover Letter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application Progress</Text>
          <Text style={styles.currentStatusText}>
            Current Status:{" "}
            <Text style={styles.currentStatusValue}>
              {currentStatus.replaceAll("_", " ")}
            </Text>
          </Text>

          {timeline?.length ? (
            timeline.map((item, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <Text style={styles.timelineStage}>{item.label}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                {!!item.details && (
                  <Text style={styles.timelineDetails}>{item.details}</Text>
                )}
              </View>
            ))
          ) : (
            <Text>No progress yet.</Text>
          )}

          {currentStatus !== "accepted" && currentStatus !== "rejected" && (
  <TouchableOpacity
    style={[
      styles.underReviewBtn,
      (updatingUnderReview ||
        currentStatus === "under_review") && { backgroundColor: "#ccc" },
    ]}
    onPress={
      currentStatus !== "under_review" ? handleUnderReview : undefined
    }
    disabled={updatingUnderReview || currentStatus === "under_review"}
  >
    {updatingUnderReview ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.underReviewText}>
        {currentStatus === "under_review"
          ? "Already Under Review"
          : "Mark Under Review"}
      </Text>
    )}
  </TouchableOpacity>
)}


        </View>

        {/* Interviews */}
        <View style={styles.section}>
          <View style={styles.interviewHeaderRow}>
            <Text style={styles.sectionTitle}>Interviews</Text>

            {currentStatus !== "accepted" && currentStatus !== "rejected" && (
  <TouchableOpacity
    style={styles.scheduleBtn}
    onPress={() => setShowScheduleModal(true)}
  >
    <Ionicons name="calendar-outline" size={16} color="#fff" />
    <Text style={styles.scheduleBtnText}>Schedule Interview</Text>
  </TouchableOpacity>
)}


          </View>

          {interviews?.length ? (
            interviews.map((iv, i) => (
              <TouchableOpacity
                key={i}
                style={styles.interviewItem}
                onPress={() =>
                  navigation.navigate("InterviewDetail", {
                    interview: iv,
                    isEmployer: true,
                  })
                }
              >
                <Text style={styles.interviewLine}>
                  {iv.interview_type === "online"
                    ? `Online via ${iv.link || "—"}`
                    : `On-site at ${iv.location || "—"}`}
                </Text>
                <Text style={styles.interviewLine}>
                  Scheduled:{" "}
                  {iv.scheduled_at
                    ? new Date(iv.scheduled_at).toLocaleString()
                    : "TBD"}
                </Text>
                <Text style={styles.interviewLine}>
                  RSVP: {iv.rsvp_status || "pending"}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text>No interviews yet.</Text>
          )}
        </View>

          <Text style={styles.sectionTitle}>Verdict </Text>
        {/* Verdict Button */}
        {currentStatus !== "accepted" && currentStatus !== "rejected" && (
          <TouchableOpacity
            style={styles.verdictBtn}
            onPress={() => setShowVerdictModal(true)}
          >
            <MaterialIcons name="gavel" size={18} color="#fff" />
            <Text style={styles.verdictBtnText}>Pass Verdict</Text>
          </TouchableOpacity>
        )}

        {/* Verdict Section */}
        {verdict && (
          <View style={styles.section}>
            
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(verdict.status) },
              ]}
            >
              <Text style={styles.statusText}>
                {formatStatusLabel(verdict.status)}
              </Text>
            </View>

            {!!verdict.verdict_message && (
              <Text style={{ color: "#444", marginTop: 6, marginBottom: 8 }}>
                {verdict.verdict_message}
              </Text>
            )}

            {!!verdict.verdict_doc && (
              <TouchableOpacity
                style={styles.documentButton}
                onPress={() => openDoc(verdict.verdict_doc)}
              >
                <MaterialIcons name="description" size={20} color="#fff" />
                <Text style={styles.documentButtonText}>View Verdict Document</Text>
              </TouchableOpacity>
            )}
          </View>
        )}


      </View>

        {/* ================== 📅 Schedule Interview Modal ================== */}
<Modal
  visible={showScheduleModal}
  animationType="slide"
  transparent
  onRequestClose={() => setShowScheduleModal(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Schedule Interview</Text>

      {/* Type Selector */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleChip,
            interviewType === "online" && styles.toggleChipActive,
          ]}
          onPress={() => setInterviewType("online")}
        >
          <Text
            style={[
              styles.toggleChipText,
              interviewType === "online" && styles.toggleChipTextActive,
            ]}
          >
            Online
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleChip,
            interviewType === "on_site" && styles.toggleChipActive,
          ]}
          onPress={() => setInterviewType("on_site")}
        >
          <Text
            style={[
              styles.toggleChipText,
              interviewType === "on_site" && styles.toggleChipTextActive,
            ]}
          >
            On-site
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date-Time Picker */}
      <Text style={styles.inputLabel}>Schedule Date & Time</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={handlePickDateTime} // Opens the combined date+time picker
      >
        <Text>
          {scheduledAt
            ? new Date(scheduledAt).toLocaleString()
            : "Select Date & Time"}
        </Text>
      </TouchableOpacity>

      {renderDateTimePickers()}

      {/* Dynamic input based on type */}
      {interviewType === "online" ? (
        <>
          <Text style={styles.inputLabel}>Meeting Link</Text>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="https://meet.example.com/..."
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      ) : (
        <>
          <Text style={styles.inputLabel}>Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Enter location..."
            style={styles.input}
          />
        </>
      )}

      {/* Notes */}
      <Text style={styles.inputLabel}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional details..."
        style={[styles.input, { height: 80 }]}
        multiline
      />

      {/* Actions */}
      <View style={styles.modalActions}>
        <TouchableOpacity
          style={[styles.modalBtn, styles.modalCancel]}
          onPress={() => setShowScheduleModal(false)}
        >
          <Text style={styles.modalBtnTextAlt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalBtn, styles.modalPrimary]}
          onPress={handleScheduleInterview}
          disabled={scheduling}
        >
          {scheduling ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.modalBtnText}>Schedule</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

      

      {/* ───── Verdict Modal ───── */}
      <Modal
        visible={showVerdictModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerdictModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pass Verdict</Text>

            {/* Status Toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  verdictStatus === "accepted" && styles.toggleChipActive,
                ]}
                onPress={() => setVerdictStatus("accepted")}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    verdictStatus === "accepted" && styles.toggleChipTextActive,
                  ]}
                >
                  Accepted
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  verdictStatus === "rejected" && styles.toggleChipActive,
                ]}
                onPress={() => setVerdictStatus("rejected")}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    verdictStatus === "rejected" && styles.toggleChipTextActive,
                  ]}
                >
                  Rejected
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Optional message to applicant..."
              multiline
              value={verdictMessage}
              onChangeText={setVerdictMessage}
            />

            <TouchableOpacity
              style={styles.fileBtn}
              onPress={pickVerdictDocument}
            >
              <MaterialIcons name="attach-file" size={20} color="#4A6FA5" />
              <Text style={styles.fileBtnText}>
                {verdictDoc ? verdictDoc.name : "Attach verdict document (PDF)"}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setShowVerdictModal(false)}
              >
                <Text style={styles.modalBtnTextAlt}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalPrimary]}
                onPress={handleSubmitVerdict}
                disabled={submittingVerdict}
              >
                {submittingVerdict ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loadingText: { marginTop: 10, color: "#666" },
  errorText: { color: "#d32f2f", fontSize: 16, marginTop: 10, textAlign: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },

  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 12 },
  jobTitle: { fontSize: 22, fontWeight: "bold", color: "#333" },
  company: { fontSize: 18, color: "#4A6FA5", marginTop: 4 },
  location: { fontSize: 15, color: "#666", marginTop: 2 },
  date: { fontSize: 13, color: "#888", marginTop: 8, fontStyle: "italic" },

  statusPinRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 ,alignSelf: "flex-start",},
  statusNeutral: { backgroundColor: "#c3c7cf" },
  statusRejected: { backgroundColor: "#ff6d6d" },
  statusAccepted: { backgroundColor: "#79c97a" },
  statusText: { color: "#fff", fontWeight: "600" },

  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#4A6FA5",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  pinButtonActive: { backgroundColor: "#4A6FA5" },
  pinText: { color: "#4A6FA5", fontWeight: "600", fontSize: 13 },

  section: { marginVertical: 16 },
  sectionTitle: { fontWeight: "600", fontSize: 18, marginBottom: 10, color: "#222" },
  bodyText: { fontSize: 15, color: "#444" },

  documentButton: {
    backgroundColor: "#4A6FA5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  disabledButton: { backgroundColor: "#b0b0b0" },
  documentButtonText: { color: "#fff", fontWeight: "600", marginLeft: 8 },

  progressHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  currentStatusText: { fontSize: 13, color: "#666" },
  currentStatusValue: { fontWeight: "700", color: "#333" },

  timelineItem: { marginBottom: 10 },
  timelineStage: { fontWeight: "600", fontSize: 15, color: "#222" },
  timelineTime: { color: "#777", fontSize: 13 },
  timelineDetails: { fontSize: 13, color: "#444" },

  underReviewBtn: {
    backgroundColor: "#5271ff",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  underReviewText: { color: "#fff", fontWeight: "700" },

  interviewHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scheduleBtn: {
    backgroundColor: "#4A6FA5",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scheduleBtnText: { color: "#fff", fontWeight: "700" },

  interviewItem: {
    padding: 12,
    borderRadius: 8,
    borderColor: "#eee",
    borderWidth: 1,
    marginBottom: 8,
    backgroundColor: "#fafbff",
  },
  interviewLine: { color: "#333", marginBottom: 3 },

  verdictBtn: {
    backgroundColor: "#2f9e44",
    flexDirection: "row",
    alignItems: "center",
    alignSelf:"center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  verdictBtnText: { color: "#fff", fontWeight: "700" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  inputLabel: { fontSize: 13, color: "#555", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },

  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 6, marginTop: 8 },
  toggleChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  toggleChipActive: {
    backgroundColor: "#4A6FA5",
    borderColor: "#4A6FA5",
  },
  toggleChipText: { color: "#333", fontWeight: "600" },
  toggleChipTextActive: { color: "#fff" },

  fileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#4A6FA5",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  fileBtnText: { color: "#4A6FA5", fontWeight: "700" },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancel: { backgroundColor: "#e9ecef" },
  modalPrimary: { backgroundColor: "#4A6FA5" },
  modalBtnText: { color: "#fff", fontWeight: "700" },
  modalBtnTextAlt: { color: "#333", fontWeight: "700" },
});

export default ApplicantDetailScreen;