import React, { useState } from 'react';
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
import { postRequest } from '../../services/api';
import LocationPicker from '../../components/LocationPicker';


const JobCreationFormScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    salary: '',
    position: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const [locationData, setLocationData] = useState(null);

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Job title is required');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Job description is required');
      return;
    }

    if (!locationData) {
  Alert.alert('Error', 'Please select a location on the map');
  return;
}

    try {
      setSubmitting(true);
      
      // Log the payload being sent
      console.log('Submitting job:', formData);
      
      const response = await postRequest('/jobs', {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        description: formData.description,
        salary: formData.salary,
        position: formData.position,

        latitude: locationData.latitude,
        longitude: locationData.longitude,
        geocoded_address: locationData.geocoded_address
      });

      // Debug: Log full response
      console.log('API Response:', response);

      // Handle both possible response formats
      const jobId = response.data?.job_id || response.data?.data?.job_id;
      
      if (!jobId) {
        throw new Error('Job ID not received from server');
      }

      Alert.alert('Success', 'Job posted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.replace('PostedJobDetail', { job_id: jobId })
        }
      ]);

    } catch (error) {
      console.error('Job creation error:', error);
      
      let errorMessage = 'Failed to create job post';
      if (error.response) {
        // Handle HTTP errors
        if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.formCard}>
        <Text style={styles.label}>Job Title *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => handleChange('title', text)}
          placeholder="Enter job title"
          placeholderTextColor="#999"
          maxLength={100}
        />

      <Text style={styles.label}>Position *</Text>
        <TextInput
          style={styles.input}
          value={formData.position}
          onChangeText={(text) => handleChange('position', text)}
          placeholder="Enter position"
          placeholderTextColor="#999"
          maxLength={80}
        />
        

      <Text style={styles.label}>Salary *</Text>
        <TextInput
          style={styles.input}
          value={formData.salary}
          onChangeText={(text) => handleChange('salary', text)}
          placeholder="Enter salary"
          placeholderTextColor="#999"
          maxLength={80}
        />

        <Text style={styles.label}>Company Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.company}
          onChangeText={(text) => handleChange('company', text)}
          placeholder="Enter company name"
          placeholderTextColor="#999"
          maxLength={80}
        />
        
        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(text) => handleChange('location', text)}
          placeholder="Enter job location"
          placeholderTextColor="#999"
          maxLength={80}
        />

        <Text style={styles.label}>Map Location *</Text>
        <LocationPicker onLocationPicked={setLocationData} />

        
        <Text style={styles.label}>Job Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => handleChange('description', text)}
          placeholder="Describe the job responsibilities, requirements, etc."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Publish</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  formCard: {
    backgroundColor: '#fff',
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
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4A6FA5',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 5,
  },
});

export default JobCreationFormScreen;