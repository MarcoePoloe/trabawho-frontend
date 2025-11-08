// screens/Shared/InterviewDetailScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { getRequest, putForm } from "../../services/api";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

// ISO helper -> "2025-11-08T23:00:00Z"
const toISOStringZ = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z");

// Android combined Date+Time picker
const openDateTimePicker = (onPicked) => {
  const now = new Date();
  DateTimePickerAndroid.open({
    value: now,
    mode: "date",
    minimumDate: now,
    onChange: (_e, pickedDate) => {
      if (!pickedDate) return;
      DateTimePickerAndroid.open({
        value: pickedDate,
        mode: "time",
        is24Hour: true,
        onChange: (_e2, pickedTime) => {
          if (!pickedTime) return;
          const merged = new Date(
            pickedDate.getFullYear(),
            pickedDate.getMonth(),
            pickedDate.getDate(),
            pickedTime.getHours(),
            pickedTime.getMinutes()
          );
          onPicked(merged);
        },
      });
    },
  });
};

const InterviewDetailScreen = () => {
  const route = useRoute();
  const { interview, isEmployer = false } = route.params || {};

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Jobseeker RSVP state
  const [rsvpNote, setRsvpNote] = useState("");
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);

  // Jobseeker reschedule modal
  const [jsShowResched, setJsShowResched] = useState(false);
  const [jsSelectedDate, setJsSelectedDate] = useState(null);
  const [jsReason, setJsReason] = useState("");
  const [jsSubmitting, setJsSubmitting] = useState(false);

  // Employer reschedule modal
  const [emShowResched, setEmShowResched] = useState(false);
  const [emSelectedDate, setEmSelectedDate] = useState(null);
  const [emInterviewType, setEmInterviewType] = useState("online"); // 'online' | 'on_site'
  const [emLocation, setEmLocation] = useState("");
  const [emLink, setEmLink] = useState("");
  const [emDetails, setEmDetails] = useState("");
  const [emMessage, setEmMessage] = useState("");
  const [emSubmitting, setEmSubmitting] = useState(false);

  // Employer confirm-reschedule modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // Employer cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const fetchInterviewDetails = async () => {
    try {
      const res = await getRequest(`/interviews/details/${interview.interview_id}`);
      setDetails(res?.data?.interview || interview);
    } catch (err) {
      console.error("❌ Error fetching interview details:", err);
      Alert.alert("Error", "Failed to load interview details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviewDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────── Jobseeker actions ───────────
  const handleRSVP = async (status) => {
    try {
      setRsvpSubmitting(true);
      const form = new URLSearchParams();
      form.append("rsvp_status", status);
      if (rsvpNote?.trim()) form.append("rsvp_note", rsvpNote.trim());

      await putForm(`/interviews/${details.interview_id}/rsvp`, form);
      Alert.alert("Success", `You have ${status} this interview.`);
      setRsvpNote("");
      await fetchInterviewDetails();
    } catch (err) {
      console.error("❌ RSVP error:", err);
      Alert.alert("Error", "Failed to update RSVP.");
    } finally {
      setRsvpSubmitting(false);
    }
  };

  const handleJsReschedule = async () => {
    if (!jsSelectedDate) {
      Alert.alert("Missing Date", "Please select a new date and time.");
      return;
    }
    try {
      setJsSubmitting(true);
      const formatted = toISOStringZ(jsSelectedDate);
      const data = new URLSearchParams();
      data.append("rsvp_status", "reschedule_requested");
      data.append("requested_schedule", formatted);
      if (jsReason?.trim()) data.append("rsvp_note", jsReason.trim());

      await putForm(`/interviews/${details.interview_id}/rsvp`, data);
      Alert.alert("Request Sent", "Your reschedule request has been submitted.");
      setJsShowResched(false);
      setJsReason("");
      setJsSelectedDate(null);
      await fetchInterviewDetails();
    } catch (err) {
      console.error("❌ Reschedule request error:", err);
      Alert.alert("Error", "Failed to request reschedule.");
    } finally {
      setJsSubmitting(false);
    }
  };

  // ─────────── Employer actions ───────────
  const handleEmployerReschedule = async () => {
    if (!emSelectedDate) {
      Alert.alert("Missing Date", "Please select a date and time.");
      return;
    }
    if (!["online", "on_site"].includes(emInterviewType)) {
      Alert.alert("Invalid Type", "Interview type must be online or on_site.");
      return;
    }

    try {
      setEmSubmitting(true);
      const payload = new URLSearchParams();
      payload.append("new_schedule", toISOStringZ(emSelectedDate));
      payload.append("interview_type", emInterviewType);
      if (emInterviewType === "online" && emLink.trim()) payload.append("link", emLink.trim());
      if (emInterviewType === "on_site" && emLocation.trim()) payload.append("location", emLocation.trim());
      if (emDetails.trim()) payload.append("details", emDetails.trim());
      if (emMessage.trim()) payload.append("message", emMessage.trim());

      await putForm(`/interviews/${details.interview_id}/reschedule`, payload);
      Alert.alert("Updated", "Interview rescheduled.");
      setEmShowResched(false);
      setEmSelectedDate(null);
      setEmInterviewType("online");
      setEmLink("");
      setEmLocation("");
      setEmDetails("");
      setEmMessage("");
      await fetchInterviewDetails();
    } catch (err) {
      console.error("❌ Employer reschedule error:", err);
      Alert.alert("Error", "Failed to reschedule interview.");
    } finally {
      setEmSubmitting(false);
    }
  };

  const handleConfirmReschedule = async () => {
    try {
      setConfirmSubmitting(true);
      const form = new URLSearchParams();
      if (confirmMessage?.trim()) form.append("message", confirmMessage.trim());
      await putForm(`/interviews/${details.interview_id}/confirm-reschedule`, form);
      Alert.alert("Confirmed", "Reschedule request has been confirmed.");
      setShowConfirmModal(false);
      setConfirmMessage("");
      await fetchInterviewDetails();
    } catch (err) {
      console.error("❌ Confirm reschedule error:", err);
      Alert.alert("Error", "Failed to confirm reschedule.");
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleCancelInterview = () => {
    setCancelMessage("");
    setShowCancelModal(true);
  };

  const confirmCancelInterview = async () => {
    if (!cancelMessage.trim()) {
      Alert.alert("Missing Reason", "Please provide a reason for cancelling.");
      return;
    }
    try {
      setCancelSubmitting(true);
      const payload = new URLSearchParams();
      payload.append("message", cancelMessage.trim());
      await putForm(`/interviews/${details.interview_id}/cancel`, payload);
      Alert.alert("Cancelled", "Interview has been cancelled.");
      setShowCancelModal(false);
      await fetchInterviewDetails();
    } catch (err) {
      console.error("❌ Cancel error:", err);
      Alert.alert("Error", "Failed to cancel interview.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // ─────────── Render helpers ───────────
  const renderJobseekerActions = () => {
    const rs = details?.rsvp_status;

    // If cancelled or declined → no actions
    if (rs === "cancelled" || rs === "declined") {
      return (
        <Text style={styles.noticeText}>
          This interview is {rs}. Wait for the employer to schedule a new one.
        </Text>
      );
    }

    // Awaiting employer confirmation
    if (rs === "reschedule_requested") {
      return (
        <Text style={styles.noticeText}>
          Your reschedule request is awaiting employer confirmation.
        </Text>
      );
    }

    // Already accepted → only request reschedule
    if (rs === "accepted") {
      return (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setJsShowResched(true)}>
            <Text style={styles.btnText}>Request Reschedule</Text>
          </TouchableOpacity>
        </>
      );
    }

    // Pending → accept/decline + request reschedule
    return (
      <>
        <TextInput
          style={styles.input}
          placeholder="Optional note (visible to employer)"
          value={rsvpNote}
          onChangeText={setRsvpNote}
          multiline
        />
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: "#79c97a" }]}
          onPress={() => handleRSVP("accepted")}
          disabled={rsvpSubmitting}
        >
          {rsvpSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Accept Interview</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: "#d9534f" }]}
          onPress={() => handleRSVP("declined")}
          disabled={rsvpSubmitting}
        >
          {rsvpSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Decline</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setJsShowResched(true)}>
          <Text style={styles.btnText}>Request Reschedule</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderEmployerActions = () => {
    const rs = details?.rsvp_status;
    const hasRequest = !!details?.requested_schedule;

    return (
      <View>
        {/* Reschedule (employer-initiated) */}
        {rs !== "cancelled" && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setEmShowResched(true)}>
            <Text style={styles.btnText}>Reschedule Interview</Text>
          </TouchableOpacity>
        )}

        {/* Confirm requested schedule (only when candidate requested) */}
        {hasRequest && rs === "reschedule_requested" && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: "#79c97a" }]}
            onPress={() => setShowConfirmModal(true)}
          >
            <Text style={styles.btnText}>Confirm Requested Schedule</Text>
          </TouchableOpacity>
        )}

        {/* Cancel interview (requires message, hidden if already cancelled) */}
        {rs !== "cancelled" && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelInterview}>
            <Text style={styles.cancelButtonText}>Cancel Interview</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading || !details) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A6FA5" />
        <Text style={styles.loadingText}>Loading interview details...</Text>
      </View>
    );
  }

  const friendlyDate = details.scheduled_at
    ? new Date(details.scheduled_at).toLocaleString()
    : "Not scheduled";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Interview Details</Text>

        {/* RSVP status field */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>RSVP Status:</Text>
          <Text style={styles.value}>{details.rsvp_status || "N/A"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{details.interview_type || "N/A"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{friendlyDate}</Text>
        </View>

        {details.interview_type === "online" ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Meeting Link:</Text>
            <Text style={[styles.value, { color: "#4A6FA5" }]}>{details.link || "N/A"}</Text>
          </View>
        ) : (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>{details.location || "N/A"}</Text>
          </View>
        )}

        {details.details && (
          <View style={styles.section}>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.value}>{details.details}</Text>
          </View>
        )}

        {details.requested_schedule && (
          <View style={[styles.section, { marginTop: 6 }]}>
            <Text style={styles.label}>Requested Schedule:</Text>
            <Text style={styles.value}>
              {new Date(details.requested_schedule).toLocaleString()}
            </Text>
          </View>
        )}

        <View style={{ marginTop: 20 }}>
          {isEmployer ? renderEmployerActions() : renderJobseekerActions()}
        </View>
      </View>

      {/* ───── Jobseeker Reschedule Modal ───── */}
      <Modal
        visible={jsShowResched}
        transparent
        animationType="slide"
        onRequestClose={() => setJsShowResched(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Reschedule</Text>

            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => openDateTimePicker(setJsSelectedDate)}
            >
              <MaterialIcons name="calendar-today" size={20} color="#4A6FA5" />
              <Text style={styles.datePickerText}>
                {jsSelectedDate ? jsSelectedDate.toLocaleString() : "Pick date & time"}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Reason for rescheduling..."
              value={jsReason}
              onChangeText={setJsReason}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#ccc" }]}
                onPress={() => setJsShowResched(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleJsReschedule}
                disabled={jsSubmitting}
              >
                {jsSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───── Employer Reschedule Modal ───── */}
      <Modal
        visible={emShowResched}
        transparent
        animationType="slide"
        onRequestClose={() => setEmShowResched(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reschedule Interview</Text>

            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => openDateTimePicker(setEmSelectedDate)}
            >
              <MaterialIcons name="calendar-today" size={20} color="#4A6FA5" />
              <Text style={styles.datePickerText}>
                {emSelectedDate ? emSelectedDate.toLocaleString() : "Pick date & time"}
              </Text>
            </TouchableOpacity>

            {/* Type toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                onPress={() => setEmInterviewType("online")}
                style={[
                  styles.toggleBtn,
                  emInterviewType === "online" && styles.toggleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    emInterviewType === "online" && styles.toggleTextActive,
                  ]}
                >
                  Online
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEmInterviewType("on_site")}
                style={[
                  styles.toggleBtn,
                  emInterviewType === "on_site" && styles.toggleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    emInterviewType === "on_site" && styles.toggleTextActive,
                  ]}
                >
                  On-site
                </Text>
              </TouchableOpacity>
            </View>

            {emInterviewType === "online" ? (
              <TextInput
                style={styles.input}
                placeholder="Meeting link (e.g., Google Meet)"
                value={emLink}
                onChangeText={setEmLink}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Location (address)"
                value={emLocation}
                onChangeText={setEmLocation}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Additional details (optional)"
              value={emDetails}
              onChangeText={setEmDetails}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Reason for rescheduling (optional)"
              value={emMessage}
              onChangeText={setEmMessage}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#ccc" }]}
                onPress={() => setEmShowResched(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleEmployerReschedule}
                disabled={emSubmitting}
              >
                {emSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───── Employer Confirm-Reschedule Modal ───── */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Requested Schedule</Text>
            <Text style={{ marginBottom: 8, color: "#444" }}>
              Candidate requested:{" "}
              {details?.requested_schedule
                ? new Date(details.requested_schedule).toLocaleString()
                : "N/A"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Optional message to candidate…"
              value={confirmMessage}
              onChangeText={setConfirmMessage}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#ccc" }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleConfirmReschedule}
                disabled={confirmSubmitting}
              >
                {confirmSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───── Employer Cancel Interview Modal ───── */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Interview</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter reason for cancelling…"
              value={cancelMessage}
              onChangeText={setCancelMessage}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#ccc" }]}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={confirmCancelInterview}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirm Cancel</Text>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#666" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16, color: "#333" },
  infoRow: { flexDirection: "row", marginBottom: 6 },
  label: { fontWeight: "600", color: "#444", width: 140 },
  value: { color: "#333", flexShrink: 1 },
  section: { marginTop: 10 },
  noticeText: {
    textAlign: "center",
    color: "#555",
    fontStyle: "italic",
    marginVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    textAlignVertical: "top",
    minHeight: 44,
  },
  primaryBtn: {
    backgroundColor: "#4A6FA5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A6FA5",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  datePickerText: { marginLeft: 10, color: "#4A6FA5" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  modalButton: {
    backgroundColor: "#4A6FA5",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
  },
  toggleRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A6FA5",
  },
  toggleBtnActive: { backgroundColor: "#4A6FA5" },
  toggleText: { color: "#4A6FA5", fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  cancelButton: {
    backgroundColor: "#d9534f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cancelButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});

export default InterviewDetailScreen;