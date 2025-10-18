import axios from 'axios';
import { API_URL } from '../constants/apiurl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
  },
});

export async function postRequest(endpoint, data, useFormData = false) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  if (useFormData) {
    const form = new URLSearchParams();
    for (const key in data) {
      form.append(key, data[key]);
    }
    return api.post(endpoint, form.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  return api.post(endpoint, data, { headers });
}

export async function getRequest(endpoint) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  return api.get(endpoint, { headers });
}

export async function getWithForm(endpoint, formData) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  return api.get(endpoint, formData, { headers });
}

export async function putRequest(endpoint, data) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  return api.put(endpoint, data, { headers });
}

export async function putWithForm(endpoint, formData) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  console.log('🛰️ PUT form request:', endpoint);
  console.log('📦 Headers:', headers);
  console.log('📦 FormData:', formData);

  return api.put(endpoint, formData, { headers });
}

export async function deleteRequest(endpoint) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  return api.delete(endpoint, { headers });
}

export async function postWithAuth(endpoint, data, token, useFormData = false) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  if (useFormData) {
    headers['Content-Type'] = 'multipart/form-data';
    return api.post(endpoint, data, { headers });
  }

  return api.post(endpoint, data, { headers });
}

export async function putWithAuth(endpoint, data, token, useFormData = false) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  if (useFormData) {
    headers['Content-Type'] = 'multipart/form-data';
    return api.put(endpoint, data, { headers });
  }

  return api.put(endpoint, data, { headers });
}



export default api;