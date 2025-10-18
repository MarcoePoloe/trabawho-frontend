import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getRequest } from '../../services/api';


const JobApplicantListScreen = ({ route, navigation }) => {
  const { job } = route.params;
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        setLoading(true);
        const response = await getRequest(`/jobs/${job.job_id}/applicants`);
        setApplicants(response.data?.applicants || []);
      } catch (error) {
        console.error('Error fetching applicants:', error);
        // Optional: Add user feedback here
      } finally {
        setLoading(false);
      }
    };

    fetchApplicants();
  }, [job.job_id]);

  const paginatedApplicants = applicants.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const renderApplicantItem = (applicant) => (
    <TouchableOpacity 
      key={applicant.application_id}
      style={styles.applicantCard}
      onPress={() => navigation.navigate('ApplicantDetail', { 
        application: applicant,
        job 
      })}
    >
      <View style={styles.applicantInfo}>
        <Text style={styles.applicantName}>{applicant.applicant?.name || 'No Name'}</Text>
        <Text style={styles.jobTitle}>{job.title}</Text>
        <Text style={styles.appliedDate}>
          Applied: {new Date(applicant.applied_at).toLocaleDateString()}
        </Text>
      </View>
      
      <View style={[
        styles.statusBadge,
        applicant.status === 'accepted' && styles.statusAccepted,
        applicant.status === 'rejected' && styles.statusRejected
      ]}>
        <Text style={styles.statusText}>
          {applicant.status || 'pending'}
        </Text>
      </View>
      
      <MaterialIcons 
        name="chevron-right" 
        size={24} 
        color="#999" 
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
  <View style={styles.container}>
    <Text style={styles.header}>Applicants for {job.title}</Text>
    
    {applicants.length === 0 ? (
      <Text style={styles.emptyText}>No applicants yet</Text>
    ) : (
      <ScrollView style={styles.listContainer}>
        {applicants.map((applicant) => (
          <TouchableOpacity 
            key={applicant.application_id}
            style={styles.applicantCard}
            onPress={() => navigation.navigate('ApplicantDetail', { 
              application: applicant,
              job 
            })}
          >
            <View style={styles.applicantInfo}>
              <Text style={styles.applicantName}>{applicant.applicant?.name || 'No Name'}</Text>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.appliedDate}>
                Applied: {new Date(applicant.applied_at).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={[
              styles.statusBadge,
              applicant.status === 'accepted' && styles.statusAccepted,
              applicant.status === 'rejected' && styles.statusRejected
            ]}>
              <Text style={styles.statusText}>
                {applicant.status ? applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1).toLowerCase() : 'Pending'}
              </Text>
            </View>
            
            <MaterialIcons 
              name="chevron-right" 
              size={24} 
              color="#999" 
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    )}
  </View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  listContainer: {
    flex: 1,
    // marginBottom: 20,
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
  jobTitle: {
    fontSize: 14,
    color: '#4A6FA5',
    marginBottom: 3,
  },
  appliedDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  statusAccepted: {
    backgroundColor: '#e8f5e9',
  },
  statusRejected: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  paginationButton: {
    padding: 10,
  },
  paginationText: {
    color: '#4A6FA5',
    fontWeight: '600',
  },
  pageNumber: {
    color: '#666',
  },
});

export default JobApplicantListScreen; 