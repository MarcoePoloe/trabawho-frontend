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
import { getRequest, postRequest } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';


const JobDetailsScreen = ({ navigation, route }) => {
  const { job } = route.params || {};
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [justification, setJustification] = useState(null);
const [loadingJustification, setLoadingJustification] = useState(false);

  const [applicationId, setApplicationId] = useState(null);
  const isFocused = useIsFocused();

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

  const handleJustifyMatch = async () => {
  if (!job?.job_id || !job?.match_percentage) return;

  try {
    setLoadingJustification(true);
    const token = await AsyncStorage.getItem('token');
    const response = await postRequest(
      '/ai/justify-match',
      { job_id: job.job_id, rating: job.match_percentage },
      token
    );

    // Expecting { justification: "..." }
    setJustification(response.data?.justification || 'No justification provided.');
  } catch (error) {
    console.error('Error fetching justification:', error);
    Alert.alert('Error', 'Failed to get AI justification.');
  } finally {
    setLoadingJustification(false);
  }
};



  useEffect(() => {
    if (isFocused && job?.job_id) {
      fetchApplicationStatus();
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

        <View style={styles.header}>

          {job.match_percentage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Explanation</Text>

            {!justification ? (
              <TouchableOpacity
                style={styles.justifyButton}
                onPress={handleJustifyMatch}
                disabled={loadingJustification}
              >
                {loadingJustification ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.justifyButtonText}>Justify Match</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.justificationBox}>
                <Text style={styles.justificationText}>{justification}</Text>
              </View>
            )}
          </View>
        )}
        </View>
        

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
  sectionTitleAI: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center'
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
justificationBox: {
  backgroundColor: '#f0f4fa',
  padding: 12,
  borderRadius: 8,
  marginTop: 10,
},
justificationText: {
  fontSize: 15,
  color: '#333',
  lineHeight: 22,
},

});

export default JobDetailsScreen;