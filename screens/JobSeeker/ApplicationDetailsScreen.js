import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity, 
  ScrollView 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';


import * as WebBrowser from 'expo-web-browser';
import { postRequest, deleteRequest, getRequest } from "../../services/api";
import { Ionicons } from "@expo/vector-icons";

const ApplicationDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  

  const { application } = route.params;
  const safeStatus = application.status || 'Submitted';
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [documents, setDocuments] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  
  const [pinned, setPinned] = useState(application.is_pinned || false);
  const [pinLoading, setPinLoading] = useState(false);

  const handleTogglePin = async () => {
    try {
      setPinLoading(true);
      if (pinned) {
        // 🔹 UNPIN
        await deleteRequest(`/applications/${application.application_id}/pin`);
        setPinned(false);
      } else {
        // 🔹 PIN
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

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getRequest(`/jobdetails/${application.job_id}`);
      
      if (!response.data) {
        throw new Error('Job details not found');
      }
      
      setJob(response.data);
    } catch (error) {
      console.error('Failed to fetch job:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentUrls = async () => {
    try {
      setLoadingDocs(true);
      const response = await getRequest(
        `/applications/${application.application_id}/documents`
      );
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch document URLs:', error);
      Alert.alert('Error', 'Could not load documents');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleWithdraw = async () => {
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw this application?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Withdraw', 
          style: 'destructive',
          onPress: async () => {
            try {
              setWithdrawing(true);
              
              await deleteRequest(`/applications/${application.application_id}`);
              
              Alert.alert('Success', 'Application withdrawn successfully');
              
              navigation.reset({
      index: 0,
      routes: [{ name: 'JobSeekerStack' }],
    });
              
            } catch (error) {
              console.error('Withdrawal failed:', error);
              let errorMessage = 'Failed to withdraw application';
              
              if (error.response) {
                if (error.response.status === 404) {
                  errorMessage = 'Application not found - it may have already been withdrawn';
                } else if (error.response.data?.message) {
                  errorMessage = error.response.data.message;
                }
              }
              
              Alert.alert('Error', errorMessage);
            } finally {
              setWithdrawing(false);
            }
          }
        }
      ]
    );
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
    fetchJobDetails();
    fetchDocumentUrls();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A6FA5" />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={24} color="#d32f2f" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchJobDetails}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileDetail', { user_id: job.employer_id })}
          >
            <Text style={styles.company}>{job.company}</Text>
          </TouchableOpacity>   
          <Text style={styles.location}>{job.location}</Text>
          
          {/* Application Status and Pin Button Row */}
          <View style={styles.statusPinRow}>
            {/* Status Badge */}
            {safeStatus && (
              <View style={[
                styles.statusBadge,
                safeStatus.toLowerCase() === 'rejected' && styles.statusRejected,
                safeStatus.toLowerCase() === 'accepted' && styles.statusAccepted
              ]}>
                <Text style={styles.statusText}>
                  {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1).toLowerCase()}
                </Text>
              </View>
            )}
            
            {/* Pin Button */}
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
            Applied on: {new Date(application.applied_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          
          {loadingDocs ? (
            <ActivityIndicator size="small" color="#4A6FA5" />
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.documentButton,
                  !documents?.data?.resume && styles.disabledButton
                ]}
                onPress={() => openDocument(documents?.data?.resume)}
                disabled={!documents?.data?.resume}
              >
                <MaterialIcons name="description" size={20} color="#fff" />
                <Text style={styles.documentButtonText}>
                  {documents?.data?.resume ? 'View Resume' : 'Resume Not Available'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.documentButton,
                  !documents?.data?.cover_letter && styles.disabledButton
                ]}
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

        {safeStatus !== 'Accepted' && (
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
                <Text style={styles.withdrawButtonText}>
                  {safeStatus === 'Rejected' ? 'Delete Application' : 'Withdraw Application'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A6FA5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  company: {
    fontSize: 18,
    color: '#4A6FA5',
    marginTop: 4,
  },
  location: {
    fontSize: 16,
    color: '#666',
    marginTop: 2,
  },
  date: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontStyle: 'italic',
  },
  statusPinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  statusRejected: {
    backgroundColor: '#ff6d6d',
  },
  statusAccepted: {
    backgroundColor: '#79c97a',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#4A6FA5',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  pinButtonActive: {
    backgroundColor: '#4A6FA5',
  },
  pinText: {
    color: '#4A6FA5',
    fontWeight: '500',
    fontSize: 13,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  documentButton: {
    backgroundColor: '#4A6FA5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#b0b0b0',
  },
  documentButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 10,
  },
  withdrawButton: {
    backgroundColor: '#d9534f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  withdrawButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 10,
  },
  expiryText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default ApplicationDetailsScreen;