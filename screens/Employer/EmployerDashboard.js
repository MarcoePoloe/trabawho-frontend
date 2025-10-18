import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  FlatList
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { getRequest } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

const ITEMS_PER_PAGE = 5;

const EmployerDashboard = ({ navigation }) => {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [appsPage, setAppsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);


  const [refreshKey, setRefreshKey] = useState(0); // Add this line



  const isFocused = useIsFocused();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Auth' }],
        });
      }
    };
    checkAuth();
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData(); // reuse your existing fetchData()
    } catch (e) {
      console.error('Error refreshing jobs:', e);
    } finally {
      setRefreshing(false);
    }
  };


  useEffect(() => {
    if (isFocused) {
      fetchData();
      
    }
  }, [isFocused, refreshKey]); // Add refreshKey to dependencies

  const fetchData = async () => {
    try {
      setLoading(true);
      const userRes = await getRequest('/me');
      setName(userRes.data.name);
      const jobsRes = await getRequest('/employer/jobs');
      setJobs(jobsRes.data.jobs || []);
      const appsRes = await getRequest('/applications/received');
      setApplications(appsRes.data.received_applications || []);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add this function to force refresh when coming back from ApplicantDetailScreen
  const handleApplicantPress = (application, job) => {
    navigation.navigate('ApplicantDetail', { 
      application,
      job,
      onStatusChange: () => setRefreshKey(prev => prev + 1) // Refresh when status changes
    });
  };

  const renderJobItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.jobCard}
      onPress={() => navigation.navigate('PostedJobDetail', { job_id: item.job_id })}
    >
      <Text style={styles.jobTitle}>{item.title}</Text>
      <Text style={styles.jobCompany}>{item.company}</Text>
      <Text style={styles.jobLocation}>{item.location}</Text>
    </TouchableOpacity>
  );

  const renderApplicantItem = ({ item }) => {
    // Ensure status is properly capitalized for display
    const displayStatus = item.status ? 
      item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase() : 
      'Pending';
    
    return (
      <TouchableOpacity 
        style={styles.applicantCard}
        onPress={() => handleApplicantPress(item, item.job)}
      >
        <View style={styles.applicantInfo}>
          <Text style={styles.applicantName}>{item.applicant?.name || 'No Name'}</Text>
          <Text style={styles.applicantJob}>{item.job?.title || 'No Job Title'}</Text>
          <Text style={styles.applicantDate}>
            Applied: {new Date(item.applied_at).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={[
          styles.statusBadge,
          item.status === 'accepted' && styles.statusAccepted,
          item.status === 'rejected' && styles.statusRejected,
          !item.status && styles.statusPending
        ]}>
          <Text style={styles.statusText}>{displayStatus}</Text>
        </View>
        
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}
      refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
      
      >
        <View style={styles.container}>
          <Text style={styles.welcome}>Welcome, {name}</Text>
          
         {/* Posted Jobs Section */}
<View style={styles.card}>
  <View style={styles.titleRow}>
    <Text style={styles.cardTitle}>Active Job Listings</Text>
    <TouchableOpacity 
      onPress={() => navigation.navigate('JobCreationForm')}
    >
      <MaterialIcons name="add" size={24} color="#4A6FA5" />
    </TouchableOpacity>
  </View>
  
  {jobs.length === 0 ? (
    <Text style={styles.emptyText}>No jobs posted yet</Text>
  ) : (
    <>
      {jobs.slice((jobsPage - 1) * ITEMS_PER_PAGE, jobsPage * ITEMS_PER_PAGE).map((job) => (
        <TouchableOpacity
          key={job.job_id}
          onPress={() => navigation.navigate('PostedJobDetail', { job_id: job.job_id })}
          style={styles.item}
        >
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.company}>{job.company}</Text>
          <Text style={styles.location}>{job.location}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.pagination}>
        <TouchableOpacity 
          onPress={() => setJobsPage((p) => Math.max(p - 1, 1))} 
          disabled={jobsPage === 1}
          style={styles.paginationButton}
        >
          <Text style={styles.paginationButtonText}>Previous</Text>
        </TouchableOpacity>
        {/* <Text style={styles.pageText}>Page {jobsPage}</Text> */}
        <TouchableOpacity
          onPress={() =>
            setJobsPage((p) => (p * ITEMS_PER_PAGE < jobs.length ? p + 1 : p))
          }
          disabled={jobsPage * ITEMS_PER_PAGE >= jobs.length}
          style={styles.paginationButton}
        >
          <Text style={styles.paginationButtonText}>Next </Text>
        </TouchableOpacity>
      </View>
    </>
  )}
</View>
          
         

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
  padding: 20,
  paddingBottom: 40,
  backgroundColor: '#f8f9fa',
},
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
 welcome: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 20,
},
  // section: {
  //   marginBottom: 30,
  // },
  // sectionHeader: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   marginBottom: 15,
  // },
  // sectionTitle: {
  //   fontSize: 18,
  //   fontWeight: '600',
  //   color: '#333',
  // },
  // addButton: {
  //   backgroundColor: '#4A6FA5',
  //   paddingVertical: 8,
  //   paddingHorizontal: 12,
  //   borderRadius: 5,
  // },
  // addButtonText: {
  //   color: 'white',
  //   fontWeight: '600',
  // },
  // emptyText: {
  //   textAlign: 'center',
  //   color: '#666',
  //   marginVertical: 20,
  // },
  // jobCard: {
  //   backgroundColor: 'white',
  //   borderRadius: 8,
  //   padding: 15,
  //   marginBottom: 10,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 1 },
  //   shadowOpacity: 0.1,
  //   shadowRadius: 3,
  //   elevation: 2,
  // },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  jobCompany: {
    fontSize: 14,
    color: '#4A6FA5',
    marginBottom: 3,
  },
  jobLocation: {
    fontSize: 13,
    color: '#666',
  },
  applicantCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  applicantInfo: {
    flex: 1,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  applicantJob: {
    fontSize: 14,
    color: '#4A6FA5',
    marginBottom: 3,
  },
  applicantDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginHorizontal: 10,
    backgroundColor: '#fff3cd',
  },
  statusAccepted: {
    backgroundColor: '#e8f5e9',
  },
  statusRejected: {
    backgroundColor: '#ffebee',
  },
  statusPending: {
    backgroundColor: '#fff3cd', 
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  paginationText: {
    color: '#4A6FA5',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#d9534f',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  card: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
cardTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#333',
},
titleRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
},
item: {
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
},
jobTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 4,
},
company: {
  fontSize: 14,
  color: '#4A6FA5',
  marginBottom: 4,
},
location: {
  fontSize: 14,
  color: '#666',
  marginBottom: 4,
},
pagination: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 15,
},
paginationButton: {
  padding: 8,
},
paginationButtonText: {
  color: '#4A6FA5',
  fontSize: 14,
},
pageText: {
  color: '#666',
  fontSize: 14,
},
emptyText: {
  color: '#666',
  textAlign: 'center',
  paddingVertical: 20,
},
});

export default EmployerDashboard;