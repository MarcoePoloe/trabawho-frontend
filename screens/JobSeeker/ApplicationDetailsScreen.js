import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { getRequest, deleteRequest, postRequest } from "../../services/api";

const ApplicationDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { application, currentUser } = route.params;

  const safeStatus = application.status || "Submitted";

  const [job, setJob] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pinned, setPinned] = useState(application.is_pinned || false);
  const [pinLoading, setPinLoading] = useState(false);
  const [verdict, setVerdict] = useState(null);
  // ──────────────── Fetch Functions ────────────────
  const fetchJobDetails = async () => {
    try {
      const response = await getRequest(`/jobdetails/${application.job_id}`);
      if (!response?.data) throw new Error("Job details not found");
      setJob(response.data);
    } catch (error) {
      console.error("❌ Error fetching job details:", error);
    }
  };

  const fetchDocumentUrls = async () => {
    try {
      const res = await getRequest(`/applications/${application.application_id}/documents`);
      const payload = res?.data || {};
      const inner = payload?.data || {};
      setDocuments({
        resume: inner.resume || null,
        cover_letter: inner.cover_letter || null,
        expiry: payload.expiry || null,
      });
    } catch (err) {
      console.error("❌ Error fetching documents:", err);
      setDocuments(null);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await getRequest(`/applications/${application.application_id}/progress`);
      setTimeline(res?.data?.timeline || []);
    } catch (err) {
      console.error("❌ Error fetching timeline:", err);
      setTimeline([]);
    }
  };

  const fetchInterviews = async () => {
    try {
      const res = await getRequest(`/interviews/${application.application_id}`);
      setInterviews(res?.data?.interviews || []);
    } catch (err) {
      console.error("❌ Error fetching interviews:", err);
      setInterviews([]);
    }
  };

  const fetchVerdict = async () => {
    try {
      const res = await getRequest(`/applications/${application.application_id}/verdict`);
      if (res?.data?.verdict) {
        setVerdict(res.data.verdict);
      } else {
        setVerdict(null);
      }
    } catch (err) {
      console.error("❌ Error fetching verdict:", err);
      setVerdict(null);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchJobDetails(),
        fetchDocumentUrls(),
        fetchTimeline(),
        fetchInterviews(),
        fetchVerdict(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);


  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "submitted":
        return "#6c757d"; // gray
      case "viewed":
        return "#5271ff"; // blue
      case "under_review":
        return "#ffb84d"; // amber
      case "interview_scheduled":
        return "#17a2b8"; // teal
      case "accepted":
        return "#28a745"; // green
      case "rejected":
        return "#dc3545"; // red
      default:
        return "#adb5bd"; // light gray
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

  // ──────────────── Actions ────────────────
  const handleWithdraw = async () => {
    Alert.alert(
      "Withdraw Application",
      "Are you sure you want to withdraw this application?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            try {
              setWithdrawing(true);
              await deleteRequest(`/applications/${application.application_id}`);
              Alert.alert("Success", "Application withdrawn successfully");
              navigation.reset({
                index: 0,
                routes: [{ name: "JobSeekerStack" }],
              });
            } catch (error) {
              console.error("❌ Withdrawal failed:", error);
              Alert.alert("Error", "Failed to withdraw application. Please try again.");
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const handleTogglePin = async () => {
    try {
      setPinLoading(true);
      if (pinned) {
        await deleteRequest(`/applications/${application.application_id}/pin`);
        setPinned(false);
      } else {
        await postRequest(`/applications/${application.application_id}/pin`);
        setPinned(true);
      }
    } catch (error) {
      console.error("❌ Failed to toggle pin:", error);
      Alert.alert("Error", "Could not update pinned status");
    } finally {
      setPinLoading(false);
    }
  };

  const openDocument = async (url) => {
    if (!url) {
      Alert.alert("Document not available");
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error("Failed to open document:", error);
      Alert.alert("Error", "Could not open document");
    }
  };

  const handleInterviewPress = (interview) => {
    navigation.navigate("InterviewDetail", { interview, currentUser });
  };

  // ──────────────── Rendering ────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A6FA5" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={24} color="#d32f2f" />
        <Text style={styles.errorText}>Failed to load job details</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {/* ───── Header ───── */}
        <View style={styles.header}>
          <Text style={styles.jobTitle}>{job.title}</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileDetail', { user_id: job.employer_id })}
          >

            <Text style={[styles.company, {color: "#4A6FA5", textDecorationLine: "underline" }]}>{job.company}</Text>
          </TouchableOpacity>


          <Text style={styles.location}>{job.location}</Text>

          {/* Status and Pin */}
          <View style={styles.statusPinRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(safeStatus) },
              ]}
            >
              <Text style={styles.statusText}>
                {formatStatusLabel(safeStatus)}
              </Text>
            </View>


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
          </View>

          <Text style={styles.date}>
            Applied on: {new Date(application.applied_at).toLocaleDateString()}
          </Text>
        </View>

        {/* ───── Job Description ───── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {/* ───── Documents ───── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {documents?.resume ? (
            <TouchableOpacity
              style={styles.documentButton}
              onPress={() => openDocument(documents.resume)}
            >
              <MaterialIcons name="description" size={20} color="#fff" />
              <Text style={styles.documentButtonText}>View Resume</Text>
            </TouchableOpacity>
          ) : (
            <Text>No Resume Uploaded</Text>
          )}

          {documents?.cover_letter && (
            <TouchableOpacity
              style={styles.documentButton}
              onPress={() => openDocument(documents.cover_letter)}
            >
              <MaterialIcons name="description" size={20} color="#fff" />
              <Text style={styles.documentButtonText}>View Cover Letter</Text>
            </TouchableOpacity>
          )}

          {documents?.expiry && (
            <Text style={styles.expiryText}>
              Links expire: {new Date(documents.expiry).toLocaleString()}
            </Text>
          )}
        </View>

        {/* ───── Timeline ───── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application Progress</Text>
          <Text style={styles.currentStatus}>
            Current Status:{" "}
            <Text style={[styles.currentStatusHighlight, { color: getStatusColor(safeStatus) }]}>
  {formatStatusLabel(safeStatus)}
</Text>

          </Text>
          {timeline.length > 0 ? (
            timeline.map((item, index) => (
              <View key={index} style={styles.timelineItem}>
                <Text style={styles.timelineStage}>{item.label}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                {item.details && (
                  <Text style={styles.timelineDetails}>{item.details}</Text>
                )}
              </View>
            ))
          ) : (
            <Text>No progress updates yet.</Text>
          )}
        </View>
        {/* ✅ Final Verdict Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Final Verdict</Text>
          {verdict ? (
            <View style={styles.verdictBox}>
              <Text
                style={[
                  styles.verdictStatus,
                  { color: getStatusColor(verdict.status) },
                ]}
              >
                {formatStatusLabel(verdict.status)}
              </Text>

              {verdict.verdict_message && (
                <Text style={styles.verdictMessage}>
                  {verdict.verdict_message}
                </Text>
              )}
              {verdict.verdict_doc && (
                <TouchableOpacity
                  style={styles.documentButton}
                  onPress={() => openDocument(verdict.verdict_doc)}
                >
                  <MaterialIcons name="description" size={20} color="#fff" />
                  <Text style={styles.documentButtonText}>
                    View Verdict Document
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text>No final verdict yet.</Text>
          )}
        </View>


        {/* ───── Interviews ───── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interviews</Text>
          {interviews.length > 0 ? (
            interviews.map((iv, i) => (
              <TouchableOpacity
                key={i}
                style={styles.interviewItem}
                onPress={() => handleInterviewPress(iv)}
              >
                <Text>
                  {iv.interview_type === "online"
                    ? `Online via ${iv.link}`
                    : `On-site at ${iv.location}`}
                </Text>
                <Text>
                  Scheduled:{" "}
                  {new Date(iv.scheduled_at).toLocaleString() || "TBD"}
                </Text>
                <Text>Status: {iv.rsvp_status || "Pending"}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text>No interviews yet.</Text>
          )}
        </View>

        {/* ───── Withdraw Button ───── */}
        {safeStatus !== "Accepted" && (
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={handleWithdraw}
            disabled={withdrawing}
          >
            {withdrawing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="delete-outline" size={20} color="#fff" />
                <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobTitle: { fontSize: 22, fontWeight: "bold", color: "#333" },
  company: { fontSize: 18, color: "#4A6FA5", marginTop: 4 },
  location: { fontSize: 16, color: "#666", marginTop: 2 },
  statusPinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#aaa",
  },
  statusRejected: { backgroundColor: "#ff6d6d" },
  statusAccepted: { backgroundColor: "#79c97a" },
  statusText: { color: "#fff", fontWeight: "600" },
  section: { marginVertical: 16 },
  sectionTitle: { fontWeight: "600", fontSize: 18, marginBottom: 8 },
  currentStatus: { marginBottom: 8, color: "#333" },
  currentStatusHighlight: { fontWeight: "bold", color: "#4A6FA5" },
  documentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A6FA5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  documentButtonText: { color: "#fff", fontWeight: "600", marginLeft: 8 },
  withdrawButton: {
    backgroundColor: "#d9534f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  withdrawButtonText: { color: "#fff", fontWeight: "600", marginLeft: 8 },
  expiryText: { fontSize: 12, color: "#666", textAlign: "center" },
  timelineItem: { marginBottom: 12 },
  timelineStage: { fontWeight: "600", fontSize: 15 },
  timelineTime: { color: "#777", fontSize: 13 },
  timelineDetails: { fontSize: 13, color: "#444" },
  interviewItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f0f4ff",
    marginBottom: 10,
  },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#4A6FA5",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  pinButtonActive: { backgroundColor: "#4A6FA5" },
  pinText: { color: "#4A6FA5", fontWeight: "500", fontSize: 13 },
  verdictBox: {
    backgroundColor: "#f0f4f8",
    padding: 12,
    borderRadius: 8,
  },
  verdictStatus: { fontWeight: "700", fontSize: 16 },
  verdictMessage: { marginTop: 4, color: "#444", fontSize: 14 },
  withdrawButton: {
    backgroundColor: "#d9534f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
});

export default ApplicationDetailsScreen;