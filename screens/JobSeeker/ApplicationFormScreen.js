import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';


const ApplicationFormScreen = ({ route, navigation }) => {
  const { job } = route.params || {};

  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetterFile, setCoverLetterFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!job) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={24} color="#d32f2f" />
        <Text style={styles.errorText}>Job details not found.</Text>
      </View>
    );
  }

  const pickFile = async (setter) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setter(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const previewFile = async (file) => {
    if (file && file.uri) {
      await WebBrowser.openBrowserAsync(file.uri);
    }
  };

  const handleSubmit = async () => {
    if (!resumeFile) {
      Alert.alert('Missing File', 'Resume is required to apply.');
      return;
    }
  
    setSubmitting(true);
  
    try {
      const token = await AsyncStorage.getItem('token');
  
      const formData = new FormData();
      formData.append('job_id', job.job_id);
      formData.append('resume_file', {
        uri: resumeFile.uri,
        name: resumeFile.name || 'resume.pdf',
        type: 'application/pdf',
      });
  
      if (coverLetterFile) {
        formData.append('cover_letter_file', {
          uri: coverLetterFile.uri,
          name: coverLetterFile.name || 'coverletter.pdf',
          type: 'application/pdf',
        });
      }
  
      const response = await api.post('/apply-with-files', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
  
      navigation.replace('ApplicationDetails', { 
        application: {
          application_id: response.data.application_id,
          job_id: job.job_id,
          applied_at: new Date().toISOString(),
          job: {
            title: job.title,
            company: job.company,
            location: job.location
          }
        }
      });
  
    } catch (err) {
      console.error('Submit error:', err);
      Alert.alert('Error', 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apply for {job.title}</Text>
          <Text style={styles.company}>{job.company} - {job.location}</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Description</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resume (Required)</Text>
            <TouchableOpacity 
              onPress={() => pickFile(setResumeFile)} 
              style={styles.fileButton}
            >
              <View style={styles.buttonContent}>
                <MaterialIcons name="upload-file" size={20} color="#4A6FA5" />
                <Text style={styles.fileButtonText}>
                  {resumeFile ? resumeFile.name : 'Select Resume PDF'}
                </Text>
              </View>
            </TouchableOpacity>
            {resumeFile && (
              <TouchableOpacity 
                onPress={() => previewFile(resumeFile)} 
                style={styles.previewButton}
              >
                <Text style={styles.previewButtonText}>Preview Resume</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cover Letter (Optional)</Text>
            <TouchableOpacity 
              onPress={() => pickFile(setCoverLetterFile)} 
              style={styles.fileButton}
            >
              <View style={styles.buttonContent}>
                <MaterialIcons name="upload-file" size={20} color="#4A6FA5" />
                <Text style={styles.fileButtonText}>
                  {coverLetterFile ? coverLetterFile.name : 'Select Cover Letter PDF'}
                </Text>
              </View>
            </TouchableOpacity>
            {coverLetterFile && (
              <TouchableOpacity 
                onPress={() => previewFile(coverLetterFile)} 
                style={styles.previewButton}
              >
                <Text style={styles.previewButtonText}>Preview Cover Letter</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleSubmit} 
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit Application</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginTop: 10,
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
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  company: {
    fontSize: 16,
    color: '#4A6FA5',
    marginBottom: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    marginBottom: 15,
  },
  fileButton: {
    borderWidth: 1,
    borderColor: '#4A6FA5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileButtonText: {
    color: '#4A6FA5',
    marginLeft: 10,
    fontSize: 14,
  },
  previewButton: {
    alignSelf: 'flex-end',
  },
  previewButtonText: {
    color: '#4A6FA5',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: '#4A6FA5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ApplicationFormScreen;