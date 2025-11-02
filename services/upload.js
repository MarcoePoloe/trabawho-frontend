import axios from 'axios';
import { API_URL } from '../constants/apiurl';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function uploadFile(file) {
  try {
    console.log('🛰️ uploadFile called with:', file);
    
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name || 'resume.pdf',
      type: file.type || 'application/pdf',
    });

    console.log('📦 FormData created');

    const token = await AsyncStorage.getItem('token');
    console.log('🔑 Token available:', !!token);
    console.log('🌐 API_URL:', API_URL);

    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('🚀 Making POST request to /upload-resume...');
    
    const response = await axios.post(`${API_URL}/upload-resume`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000, // 30 second timeout
    });

    console.log('✅ Upload successful, response:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Upload helper error:', error);
    
    if (error.response) {
      // Server responded with error status
      console.log('❌ Server response error:', error.response.status, error.response.data);
      throw new Error(`Server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Request made but no response
      console.log('❌ No response from server');
      throw new Error('Network error: No response from server');
    } else {
      // Something else happened
      console.log('❌ Other error:', error.message);
      throw error;
    }
  }
}