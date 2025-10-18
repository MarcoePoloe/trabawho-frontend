import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { getRequest, putRequest } from '../../services/api';


const JobEditScreen = ({ navigation, route }) => {
  // Correct way to access the job object and its ID
  const { job } = route.params || {};
  const job_id = job?.job_id;
  
  console.log('Received job object:', job);
  console.log('Extracted job_id:', job_id);

  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    position: '',
    salary: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!job_id) {
      Alert.alert('Error', 'Job ID not provided');
      navigation.goBack();
      return;
    }

    // Since we already have the job data, we can use it directly
    if (job) {
      setFormData({
        title: job.title || '',
        company: job.company || '',
        location: job.location || '',
        salary: job.salary || '',
        position: job.position || '',
        description: job.description || ''

      });
      setLoading(false);
      return;
    }

    // Fallback API fetch if job object isn't passed
    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        const response = await getRequest(`/jobdetails/${job_id}`);
        
        if (response.data) {
          setFormData({
            title: response.data.title || '',
            company: response.data.company || '',
            location: response.data.location || '',
            salary: response.data.salary || '', 
            position: response.data.position || '', 
            description: response.data.description || ''

          });
        } else {
          throw new Error('Job not found');
        }
      } catch (error) {
        console.error('Fetch error:', error);
        Alert.alert('Error', 'Failed to load job details');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [job_id]);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      Alert.alert('Error', 'Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      console.log('Submitting update for job:', job_id);
      
      const response = await putRequest(`/jobs/${job_id}`, {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        salary: formData.salary,
        position: formData.position,
        description: formData.description
      });

      console.log('Update response:', response.data);
      
      if (response.data) {
        Alert.alert(
          'Success', 
          'Job updated successfully',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('PostedJobDetail', { job_id })
            }
          ]
        );
      } else {
        throw new Error('Failed to update job');
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.message || 
        error.response?.data?.detail || 
        error.message || 
        'Failed to update job'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!job_id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Job ID not provided</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Job Title *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => setFormData({...formData, title: text})}
          placeholder="Enter job title"
        />

      <Text style={styles.label}>Position *</Text>
        <TextInput
          style={styles.input}
          value={formData.position}
          onChangeText={(text) => setFormData({...formData, position: text})}
          placeholder="Enter Position"
        />

      <Text style={styles.label}>Salary *</Text>
        <TextInput
          style={styles.input}
          value={formData.salary}
          onChangeText={(text) => setFormData({...formData, salary: text})}
          placeholder="Enter Salary"
        />
        
        <Text style={styles.label}>Company Name</Text>
        <TextInput
          style={styles.input}
          value={formData.company}
          onChangeText={(text) => setFormData({...formData, company: text})}
          placeholder="Enter company name"
        />
        
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(text) => setFormData({...formData, location: text})}
          placeholder="Enter job location"
        />
        
        <Text style={styles.label}>Job Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => setFormData({...formData, description: text})}
          placeholder="Enter job description"
          multiline
          numberOfLines={6}
        />
        
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Update Job</Text>
          )}
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
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4A6FA5',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default JobEditScreen;