import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { getRequest, postRequest, postMultipart } from '../../services/api';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { Linking, Platform } from 'react-native';
import * as DocumentPicker from "expo-document-picker";
import { Modal } from "react-native";


const JobDetailsScreen = ({ navigation, route }) => {
  const { job } = route.params || {};
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [justification, setJustification] = useState(null);
  const [loadingJustification, setLoadingJustification] = useState(false);
  const [applicationId, setApplicationId] = useState(null);
  const isFocused = useIsFocused();
  const [submitting, setSubmitting] = useState(false);
  const [showQuickApplyModal, setShowQuickApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState(null);
  const [quickApplying, setQuickApplying] = useState(false);


  const fetchApplicationStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !job?.job_id) {
        setHasApplied(false);
        return;
      }

      setLoading(true);
      const response = await getRequest('/applications/me', token);
      const applications = response.data?.applications || [];

      const existingApp = applications.find(app => app.job.job_id === job.job_id);
      if (existingApp) {
        setHasApplied(true);
        setApplicationId(existingApp.application_id);

      } else {
        setHasApplied(false);
        setApplicationId(null);
      }
    } catch (error) {
      console.error('Error checking application status:', error);
      setHasApplied(false);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickApply = async () => {
    setQuickApplying(true);

    try {
      const formData = new FormData();
      const token = await AsyncStorage.getItem('token');
      formData.append("job_id", job.job_id);

      if (coverLetter) {
        formData.append("cover_letter", {
          uri: coverLetter.uri,
          name: coverLetter.name || "cover_letter.pdf",
          type: "application/pdf",
        });
      }

      const response = await postMultipart("/apply/quick", formData);
      // const response = await api.post('/apply-with-files', formData, {
      //   headers: {
      //     'Content-Type': 'multipart/form-data',
      //     Authorization: `Bearer ${token}`,
      //   },
      // });

      const data = response?.data || response;

      if (data?.application_id) {
        Alert.alert("Success", "Application submitted successfully!");

        setShowQuickApplyModal(false);

        // navigation.navigate("ApplicationDetails", {
          
        //   application_id: data.application_id,
        //   job_id: job.job_id,
        //   status: 'Submitted',
        //   job: {
        //     title: job.title,
        //     company: job.company,
        //     location: job.location
        //   }
        // });

        navigation.navigate("ApplicationDetails", {
          application: {
            application_id: data.application_id,
            job_id: job.job_id,
            status: 'Submitted',
            job: {
              title: job.title,
              company: job.company,
              location: job.location
            }
          }
        });

      } else {
        Alert.alert("Notice", data?.message || "Application submitted.");
      }
    } catch (err) {
      console.log("❌ Quick apply failed response:", err.response?.data);
      Alert.alert(
        "Error",
        err?.response?.data?.detail || err.message || "Quick apply failed."
      );
    } finally {
      setQuickApplying(false);
    }
  };


  const pickCoverLetter = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      setCoverLetter(result.assets[0]); // { uri, name, size, mimeType }
    } catch (err) {
      console.log("⚠️ Cover letter pick error:", err);
      Alert.alert("Error", "Could not select a file.");
    }
  };


  // NEW: Updated justify match function with all required parameters
  const handleJustifyMatch = async () => {
    if (!job?.job_id || !job?.match_percentage) return;

    try {
      setLoadingJustification(true);
      const token = await AsyncStorage.getItem('token');

      // NEW: Prepare all required parameters for the updated endpoint
      const requestData = {
        job_id: job.job_id,
        rating: job.match_percentage,
        semantic_score: job.semantic_score ?? 0,
        skill_overlap: job.skill_overlap ?? 0,
        proximity_score: job.proximity_score ?? 0,
        distance_km: job.distance_km ?? 0,
        resume_skills: job.extracted_resume_skills ?? [],
        job_skills: job.extracted_job_skills ?? []
      };

      console.log("Sending justify match request:", requestData);

      const response = await postRequest(
        '/ai/justify-match-new',
        requestData,
        token
      );

      // NEW: Store the complete justification response
      setJustification(response.data);
    } catch (error) {
      console.error('Error fetching justification:', error);
      Alert.alert('Error', 'Failed to get AI justification.');
    } finally {
      setLoadingJustification(false);
    }
  };

  // NEW: Function to render skills overlap section
  const renderSkillsOverlap = () => {
    if (!justification?.skills_overlapped && !justification?.missing_skills) {
      return null;
    }

    return (
      <View style={styles.skillsSection}>
        <Text style={styles.skillsTitle}>Skills Analysis</Text>

        {/* Skills Overlap */}
        {justification.skills_overlapped && justification.skills_overlapped.length > 0 && (
          <View style={styles.skillsList}>
            <Text style={styles.skillsSubtitle}>✅ Matching Skills:</Text>
            {justification.skills_overlapped.map((skill, index) => (
              <View key={index} style={styles.skillItem}>
                <Text style={styles.skillText}>• {skill}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Missing Skills */}
        {justification.missing_skills && justification.missing_skills.length > 0 && (
          <View style={styles.skillsList}>
            <Text style={styles.skillsSubtitle}>⚠️ Missing Skills:</Text>
            {justification.missing_skills.map((skill, index) => (
              <View key={index} style={styles.skillItem}>
                <Text style={styles.missingSkillText}>• {skill}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // NEW: Function to render combined justifications
  const renderCombinedJustification = () => {
    if (!justification) return null;

    const parts = [];

    if (justification.semantic_justification) {
      parts.push(justification.semantic_justification);
    }

    if (justification.skills_justification) {
      parts.push(justification.skills_justification);
    }

    if (justification.proximity_justification) {
      parts.push(justification.proximity_justification);
    }

    if (parts.length === 0) return null;

    return (
      <View style={styles.justificationSection}>
        <Text style={styles.justificationTitle}>Match Breakdown</Text>
        <Text style={styles.combinedJustification}>
          {parts.join(' ')}
        </Text>
      </View>
    );
  };

  // NEW: Function to render match score breakdown
  const renderScoreBreakdown = () => {
    if (!justification || !job) return null;

    return (
      <View style={styles.scoreBreakdown}>
        <Text style={styles.scoreTitle}>Score Breakdown</Text>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Content Relevance:</Text>
          <Text style={styles.scoreValue}>{((job.semantic_score || 0) * 100).toFixed(1)}%</Text>
        </View>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Skills Alignment:</Text>
          <Text style={styles.scoreValue}>{((job.skill_overlap || 0) * 100).toFixed(1)}%</Text>
        </View>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Job Distance:</Text>
          <Text style={styles.scoreValue}>{((job.proximity_score || 0) * 100).toFixed(1)}%</Text>
        </View>

        <View style={styles.scoreDivider} />

        <View style={styles.scoreRow}>
          <Text style={styles.finalScoreLabel}>Overall Match:</Text>
          <Text style={styles.finalScoreValue}>{justification.match_percentage}%</Text>
        </View>

        <Text style={styles.calculationNote}>
          Calculation: (Resume × 40%) + (Skills × 50%) + (Location × 10%)
        </Text>
      </View>
    );
  };

  const renderSkillChips = (label, skills, color) => !!skills?.length && (
    <View style={styles.skillSection}>
      <Text style={styles.skillCategory}>{label}</Text>
      <View style={styles.skillWrap}>
        {skills.map((s, i) => (
          <View key={i} style={[styles.skillChip, { backgroundColor: color }]}>
            <Text style={styles.skillChipText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const ScoreBar = ({ label, value }) => {
    const pct = ((value ?? 0) * 100).toFixed(1);
    return (
      <View style={styles.scoreItem}>
        <Text style={styles.scoreLabel}>{label}: {pct}%</Text>
        <View style={styles.scoreBarBackground}>
          <View style={[styles.scoreBarFill, { width: `${pct}%` }]} />
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (isFocused && job?.job_id) {
      fetchApplicationStatus();
      console.log("PASSED DETAILS", job);
    }
  }, [job, isFocused]);

  const handleApply = () => {
    if (hasApplied) {
      // Navigate to the application details screen with existing data
      navigation.navigate('ApplicationDetails', {
        application: {
          application_id: applicationId,
          job_id: job.job_id,
          status: 'Submitted', // <-- Temporary status for new applications
          job: {
            title: job.title,
            company: job.company,
            location: job.location
          }
        }
      });
    } else {
      // Go to the application form screen
      navigation.navigate('ApplicationForm', { job });
    }
  };

  // Set the header title to the job title
  useEffect(() => {
    navigation.setOptions({
      title: job?.title || 'Job Details',
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
      },
      headerBackTitleVisible: false,
    });
  }, [navigation, job]);

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={24} color="red" />
        <Text style={styles.errorText}>Job details not available</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{job.title}</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileDetail', { user_id: job.employer_id })}
          >
            <Text style={styles.company}>{job.company}</Text>
          </TouchableOpacity>

          <View style={styles.locationContainer}>
            <MaterialIcons name="location-on" size={16} color="#666" />
            <Text style={styles.location}>{job.location}</Text>
          </View>

          {job.match_percentage && (
            <View style={styles.matchContainer}>
              <FontAwesome name="bolt" size={14} color="#FFD700" />
              <Text style={styles.matchText}>AI Match: {job.match_percentage}%</Text>
            </View>
          )}
        </View>

        {/* Map Location Section */}
        {job.latitude && job.longitude ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Location</Text>

            <View style={{ height: 260, borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: job.latitude,
                  longitude: job.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={true}   // ✅ allow moving map
                zoomEnabled={true}     // ✅ allow zoom
                pitchEnabled={true}
                rotateEnabled={true}
                showsCompass={true}
                showsScale={true}
              >
                <Marker coordinate={{ latitude: job.latitude, longitude: job.longitude }} />
              </MapView>
            </View>

            {/* Open in Maps */}
            <TouchableOpacity
              onPress={() => {
                const url = Platform.select({
                  ios: `http://maps.apple.com/?daddr=${job.latitude},${job.longitude}`,
                  android: `geo:${job.latitude},${job.longitude}?q=${job.latitude},${job.longitude}`,
                });
                Linking.openURL(url);
              }}
            >
              <Text style={{ marginTop: 8, color: '#5271ff', fontWeight: '600' }}>
                Open in Maps
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Location</Text>
            <Text style={{ color: '#777' }}>Location not available</Text>
          </View>
        )}

        {/* Divider between Map and AI Insights */}
        <View style={styles.divider} />

        {/* ✅ Match Breakdown */}
        {job.match_percentage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Match Insights</Text>

            {!justification ? (
              <TouchableOpacity style={styles.analyzeBtn} onPress={handleJustifyMatch}>
                {loadingJustification
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.analyzeText}>Analyze Match</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <ScoreBar label="Content Relevance" value={job.semantic_score} />
                <ScoreBar label="Skill Alignment" value={job.skill_overlap} />
                <ScoreBar label="Location Fit" value={job.proximity_score} />

                <Text style={styles.aiText}>{justification.semantic_justification}</Text>
                <Text style={styles.aiText}>{justification.skills_justification}</Text>
                <Text style={styles.aiText}>{justification.proximity_justification}</Text>

                {renderSkillChips("Matched Skills", justification.skills_overlapped, "#DFFFE0")}
                {renderSkillChips("Missing Skills", justification.missing_skills, "#FFE5E5")}

                <TouchableOpacity style={styles.refreshBtn} onPress={handleJustifyMatch}>
                  <Text style={styles.refreshText}>Refresh Analysis</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Divider between AI Insights and Job Details - Only show when there are AI insights */}
        {job.match_percentage && <View style={styles.divider} />}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Position: { }
            <Text style={styles.description}>{job.position ? job.position : 'not provided'}
            </Text>
          </Text>

          <Text style={styles.sectionTitle}>Salary: { }
            <Text style={styles.description}>{job.salary ? job.salary : 'not provided'}
            </Text>
          </Text>

          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {job.requirements && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <Text style={styles.description}>{job.requirements}</Text>
          </View>
        )}

        
        {!hasApplied && (
          <>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: "#2f9e44", marginTop: 10 }]}
              onPress={() => setShowQuickApplyModal(true)}
            >
              <Text style={styles.applyButtonText}>Quick Apply</Text>
            </TouchableOpacity>

            {/* <Text style={{ textAlign: "center", marginTop: 6, color: "#555" }}>
              Uses your saved resume + optional cover letter
            </Text> */}
          </>
        )}



        <View style={styles.applyContainer}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              hasApplied && styles.appliedButton
            ]}
            onPress={handleApply}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.applyButtonText}>
                {hasApplied ? 'View Application' : 'Apply Now'}
              </Text>
            )}
          </TouchableOpacity>

          {hasApplied && (
            <View style={styles.appliedMessage}>
              <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.appliedText}>You've already applied to this job</Text>
            </View>
          )}
        </View>
      </View>



      <Modal visible={showQuickApplyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quick Apply</Text>
            <Text style={styles.modalSubtitle}>
              Your saved resume will be used automatically.
            </Text>

            <View style={{ marginVertical: 15 }}>
              <Text style={styles.modalLabel}>Optional Cover Letter (PDF)</Text>

              <TouchableOpacity style={styles.filePickerBtn} onPress={pickCoverLetter}>
                <Text style={styles.filePickerText}>
                  {coverLetter ? coverLetter.name : "Select a PDF file"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, quickApplying && { opacity: 0.6 }]}
              onPress={handleQuickApply}
              disabled={quickApplying}
            >
              {quickApplying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Application</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowQuickApplyModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>




    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    marginTop: 10,
  },
  header: {
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 20,
  },
  company: {
    fontSize: 20,
    color: '#5271ff',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  location: {
    fontSize: 16,
    color: '#666',
    marginLeft: 5,
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
    marginLeft: 5,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  applyContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#5271ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  appliedButton: {
    backgroundColor: '#6c757d',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  appliedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  appliedText: {
    color: '#4CAF50',
    marginLeft: 5,
    fontSize: 14,
  },
  justifyButton: {
    backgroundColor: '#5271ff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  justifyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // NEW: Styles for the enhanced justification display
  justificationContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 0,
  },
  justificationSection: {
    marginBottom: 20,
  },
  justificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  combinedJustification: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
  skillsSection: {
    marginBottom: 20,
  },
  skillsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  skillsSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  skillsList: {
    marginBottom: 12,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  skillText: {
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 4,
  },
  missingSkillText: {
    fontSize: 14,
    color: '#D32F2F',
    marginLeft: 4,
  },
  scoreBreakdown: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5271ff',
  },
  refreshButton: {
    padding: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  refreshButtonText: {
    color: '#5271ff',
    fontWeight: '600',
  },
  analyzeBtn: { backgroundColor: '#5271ff', padding: 10, borderRadius: 8 },
  analyzeText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  aiText: { marginTop: 8, fontSize: 14, color: '#444' },
  scoreItem: { marginVertical: 6 },
  scoreLabel: { fontWeight: '600', marginBottom: 4 },
  scoreBarBackground: { height: 6, backgroundColor: '#eee', borderRadius: 4 },
  scoreBarFill: { height: 6, backgroundColor: '#5271ff', borderRadius: 4 },
  skillSection: { marginTop: 10 },
  skillCategory: { fontWeight: '600', marginBottom: 4 },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6 },
  skillChipText: { fontSize: 12, fontWeight: '600' },
  refreshBtn: {
    borderWidth: 1,
    borderColor: '#5271ff',
    padding: 10,
    borderRadius: 8,
    marginTop: 10
  },
  refreshText: { textAlign: 'center', color: '#5271ff', fontWeight: '600' },
  description: { color: '#444', marginTop: 6 },
  applyBtn: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#28a745',
    borderRadius: 8
  },
  // NEW: Divider style
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 25,
  },
  modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  padding: 20,
},
modalCard: {
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 20,
},
modalTitle: {
  fontSize: 20,
  fontWeight: "700",
  marginBottom: 6,
  color: "#333",
},
modalSubtitle: {
  fontSize: 14,
  color: "#666",
  marginBottom: 20,
},
modalLabel: {
  fontSize: 15,
  fontWeight: "600",
  marginBottom: 6,
},
filePickerBtn: {
  padding: 12,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#ccc",
},
filePickerText: {
  color: "#333",
},
submitBtn: {
  backgroundColor: "#2f9e44",
  padding: 14,
  borderRadius: 8,
  alignItems: "center",
  marginTop: 10,
},
submitBtnText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 16,
},
cancelText: {
  textAlign: "center",
  marginTop: 12,
  color: "#d00",
  fontWeight: "600",
},

});

export default JobDetailsScreen;