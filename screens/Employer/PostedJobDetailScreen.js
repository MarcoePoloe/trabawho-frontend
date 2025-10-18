import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { deleteRequest, getRequest } from '../../services/api';


const PostedJobDetailScreen = ({ navigation, route }) => {
  const { job_id } = route.params;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);



  useEffect(() => {
    
    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        const response = await getRequest(`/jobdetails/${job_id}`);
        if (response.data) {
          setJob(response.data);
        } else {
          throw new Error('Job not found');
        }
      } catch (error) {
        console.error('Error fetching job:', error);
        console.log(job.job_id);
        Alert.alert('Error', 'Failed to load job details');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    

    fetchJobDetails();
  }, [job_id]);


  const handleDelete = async () => {
    Alert.alert(
      'Delete Job Post',
      'Are you sure you want to delete this job posting?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteRequest(`/jobs/${job_id}`);
              navigation.navigate('EmployerDashboard');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete job post');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.company}>{job.company}</Text>
        <Text style={styles.location}>{job.location}</Text>
        {/* <Text style={styles.location}>{job.job_id}</Text> */}
        
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

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('JobApplicantList', { job })}
        >
          <Text style={styles.buttonText}>View Applicants</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => navigation.navigate('JobEdit', { job })}
        >
          <Text style={styles.buttonText}>Edit Job Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <Text style={styles.buttonText}>
            {isDeleting ? 'Deleting...' : 'Delete Job Post'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  company: {
    fontSize: 18,
    color: '#4A6FA5',
    marginBottom: 5,
  },
  location: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  button: {
    backgroundColor: '#4A6FA5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  editButton: {
    backgroundColor: '#6c757d',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PostedJobDetailScreen;