import axios from 'axios';
import { API_URL } from '../constants/apiurl';
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log("🌍 API_URL used in this build:", API_URL);

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
console.log("🚀 Sending POST to:", endpoint);
console.log("🧾 Data:", data);

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

export async function putForm(endpoint, data, isMultipart = false) {
  const token = await AsyncStorage.getItem("token");
  let headers = {
    Accept: "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  let payload;

  if (isMultipart) {
    // If FormData already, leave it
    if (data instanceof FormData) {
      payload = data;
    } else {
      payload = new FormData();
      for (const key in data) {
        if (data[key] !== undefined && data[key] !== null)
          payload.append(key, data[key]);
      }
    }
    headers["Content-Type"] = "multipart/form-data";
  } else {
    // For x-www-form-urlencoded
    if (data instanceof URLSearchParams) {
      payload = data;
    } else {
      payload = new URLSearchParams();
      for (const key in data) {
        if (data[key] !== undefined && data[key] !== null)
          payload.append(key, String(data[key]));
      }
    }
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return api.put(endpoint, payload, { headers });
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

export async function postMultipart(endpoint, formData) {
  const token = await AsyncStorage.getItem("token");

  const headers = {
    "Accept": "application/json",
    "Content-Type": "multipart/form-data",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  return api.post(endpoint, formData, { headers });
}



export default api;