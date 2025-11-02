import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { getRequest, putRequest, postRequest, deleteRequest } from '../../services/api';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';


const ApplicantDetailScreen = ({ route }) => {
  const navigation = useNavigation();
  const { application: initialApplication, onStatusChange } = route.params;

  const [application, setApplication] = useState(initialApplication);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState(initialApplication?.status || 'submitted');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [pinned, setPinned] = useState(initialApplication?.is_pinned || false);
  const [pinLoading, setPinLoading] = useState(false);

  // Fetch application + job + applicant info using new endpoint
  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const response = await getRequest(`/applications/${initialApplication.application_id}/details`);
      if (response.data) {
        setApplication(response.data);
        setJob(response.data.job);

        setStatus(response.data.status || response.data.application?.status || 'submitted');

        // Setup documents using signed URLs
        setDocuments({
          data: {
            resume: response.data.resume_url,
            cover_letter: response.data.cover_letter_url,
          },
          expiry: null,
        });
      }
    } catch (error) {
      console.error('Failed to fetch application details:', error);
      Alert.alert('Error', 'Could not load application details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentUrls = async () => {
    try {
      setLoadingDocs(true);
      const response = await getRequest(`/applications/${initialApplication.application_id}/documents/public`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch document URLs:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      setPinLoading(true);
      if (pinned) {
        await deleteRequest(`/applications/${initialApplication.application_id}/pin`);
        setPinned(false);
      } else {
        await postRequest(`/applications/${initialApplication.application_id}/pin`);
        setPinned(true);
      }
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      Alert.alert('Error', 'Could not update pinned status');
    } finally {
      setPinLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdating(true);
      await putRequest(`/applications/${initialApplication.application_id}/status`, { status: newStatus });
      setStatus(newStatus);
      Alert.alert('Success', 'Application status updated');
      if (onStatusChange) onStatusChange();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };


  const confirmDecide = (application_id, action) => {
  const actionLabel = action === "accept" ? "Accept" : "Reject";

  Alert.alert(
    `Confirm ${actionLabel}`,
    `Are you sure you want to ${actionLabel.toLowerCase()} this application?`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", onPress: () => handleDecide(application_id, action) },
    ]
  );
};



  const handleDecide = async (application_id, action) => {
  if (!["accept", "reject"].includes(action)) {
    Alert.alert("Error", "Action must be 'accept' or 'reject'");
    return;
  }

  try {
    setUpdating(true);
    console.log("📝 Sending action:", action); // debug

    const res = await postRequest(
      `/applications/${application_id}/decision`,
      { action },
      true
    );

    const newStatus = res.data.application?.status || (action === "accept" ? "accepted" : "rejected");
    setStatus(newStatus);

    Alert.alert("Success", res.data.message);

    if (onStatusChange) onStatusChange();
  } catch (error) {
    console.error(error);
    Alert.alert("Error", error.response?.data?.detail || "Failed to update status");
  } finally {
    setUpdating(false);
  }
};





  const openDocument = async (url) => {
    if (!url) {
      Alert.alert('Document not available');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error('Failed to open document:', error);
      Alert.alert('Error', 'Could not open document');
    }
  };

  useEffect(() => {
    fetchApplicationDetails();
    fetchDocumentUrls();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A6FA5" />
        <Text style={styles.loadingText}>Loading application details...</Text>
      </View>
    );
  }

  const applicant = application?.applicant || {};
  const applicantName = applicant?.name || 'N/A';
  const applicantEmail = applicant?.email || 'N/A';
  const applicantId = applicant?.job_seeker_id;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.jobTitle}>{job?.title || 'Job Title'}</Text>
          <Text style={styles.company}>{job?.company || 'Company'}</Text>
          <Text style={styles.location}>{job?.location || 'Location'}</Text>

          {/* Status and Pin Row */}
          <View style={styles.statusPinRow}>
            <View style={[
              styles.statusBadge,
              status.toLowerCase() === 'rejected' && styles.statusRejected,
              status.toLowerCase() === 'accepted' && styles.statusAccepted
            ]}>
              <Text style={styles.statusText}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.pinButton, pinned && styles.pinButtonActive]}
              onPress={handleTogglePin}
              disabled={pinLoading}
            >
              {pinLoading ? (
                <ActivityIndicator size="small" color={pinned ? "#fff" : "#4A6FA5"} />
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
            Applied on: {new Date(application?.applied_at).toLocaleDateString()}
          </Text>
        </View>

        {/* Applicant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant Information</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileDetail', { user_id: applicantId })}
          >
            <Text style={styles.detail}>Name: {applicantName}</Text>
          </TouchableOpacity>
          
          <Text style={styles.detail}>Email: {applicantEmail}</Text>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {loadingDocs ? (
            <ActivityIndicator size="small" color="#4A6FA5" />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.documentButton, !documents?.data?.resume && styles.disabledButton]}
                onPress={() => openDocument(documents?.data?.resume)}
                disabled={!documents?.data?.resume}
              >
                <MaterialIcons name="description" size={20} color="#fff" />
                <Text style={styles.documentButtonText}>
                  {documents?.data?.resume ? 'View Resume' : 'Resume Not Available'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.documentButton, !documents?.data?.cover_letter && styles.disabledButton]}
                onPress={() => openDocument(documents?.data?.cover_letter)}
                disabled={!documents?.data?.cover_letter}
              >
                <MaterialIcons name="description" size={20} color="#fff" />
                <Text style={styles.documentButtonText}>
                  {documents?.data?.cover_letter ? 'View Cover Letter' : 'No Cover Letter'}
                </Text>
              </TouchableOpacity>

              {documents?.expiry && (
                <Text style={styles.expiryText}>
                  Links expire: {new Date(documents.expiry).toLocaleString()}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Status Update Buttons */}
      {!["accepted", "rejected"].includes(status) && (
        <View style={styles.statusButtonsRow}>
          <TouchableOpacity
            style={[styles.statusButton, status === 'accepted' && styles.acceptedStatusBtn]}
            onPress={() => confirmDecide(initialApplication.application_id, 'accept')}
            disabled={updating}
          >
            <Text style={styles.statusButtonText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusButton, status === 'rejected' && styles.rejectedStatusBtn]}
            onPress={() => confirmDecide(initialApplication.application_id, 'reject')}
            disabled={updating}
          >
            <Text style={styles.statusButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#666' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 15 },
  jobTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  company: { fontSize: 18, color: '#4A6FA5', marginTop: 4 },
  location: { fontSize: 16, color: '#666', marginTop: 2 },
  date: { fontSize: 14, color: '#888', marginTop: 8, fontStyle: 'italic' },
  statusPinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#e0e0e0' },
  statusRejected: { backgroundColor: '#ff6d6d' },
  statusAccepted: { backgroundColor: '#79c97a' },
  statusText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  pinButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderColor: '#4A6FA5', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  pinButtonActive: { backgroundColor: '#4A6FA5' },
  pinText: { color: '#4A6FA5', fontWeight: '500', fontSize: 13 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15 },
  detail: { fontSize: 16, color: '#444', marginBottom: 8 },
  documentButton: { backgroundColor: '#4A6FA5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8, marginBottom: 12 },
  disabledButton: { backgroundColor: '#b0b0b0' },
  documentButtonText: { color: '#fff', fontWeight: '600', marginLeft: 10 },
  expiryText: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  statusButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statusButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, backgroundColor: '#eee' },
  acceptedStatusBtn: { backgroundColor: '#79c97a' },
  rejectedStatusBtn: { backgroundColor: '#ff6d6d' },
  statusButtonText: { color: '#fff', fontWeight: '600' },
});

export default ApplicantDetailScreen;
