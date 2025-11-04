// services/jobService.js
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function fetchAvailableJobs() {
  const lat = await AsyncStorage.getItem("user_lat");
  const lon = await AsyncStorage.getItem("user_lon");

  let url = "/get-jobs";

  // Only add coords if available
  if (lat && lon) {
    url += `?lat=${lat}&lon=${lon}`;
  }

  return api.get(url);
}

export async function fetchJobMatches() {
  const token = await AsyncStorage.getItem('token');
  return api.get('/match-jobs', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchJobDetails(jobId) {
  return api.get(`/jobs/${jobId}`);
}
