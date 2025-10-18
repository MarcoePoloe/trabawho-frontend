import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { postRequest, getRequest } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ScrollView } from 'react-native';

export default function EmailVerificationPendingScreen({ route, navigation }) {
  const { email, role } = route.params;
  const [isLoading, setIsLoading] = useState(false);

  const handleResend = async () => {
    try {
      setIsLoading(true);
      const email = await AsyncStorage.getItem("email");
      const raw_role = await AsyncStorage.getItem("role");
      const role = raw_role === "job-seeker" ? "job_seeker" : "employer";

      if (!email || !role) {
        Alert.alert("Error", "Missing email or role. Please log in again.");
        return;
      }

      // ✅ useFormData = true because backend expects Form(...)
      const response = await postRequest("/resend-verification", { email, role }, true);

      if (response.status === 200) {
        Alert.alert("Success", response.data.message || "Verification email sent!");
      } else {
        Alert.alert("Error", response.data.detail || "Something went wrong.");
        setIsLoading(false);
      }
    } catch (error) {
      console.log("❌ Resend verification error:", error);
      console.log(email, role)
      Alert.alert("Error", error.response?.data?.detail || "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlreadyVerified = async () => {
    setIsLoading(true);
    try {
      const res = await getRequest(`/check-verification?email=${email}&role=${role}`);
      const verified = res.data?.is_verified;

      if (verified) {
        Alert.alert('✅ Verified', 'Your email is now verified!');
        const storedRole = await AsyncStorage.getItem('role');

        navigation.reset({
          index: 0,
          routes: [{ name: storedRole === 'job-seeker' ? 'JobSeekerStack' : 'EmployerStack' }],
        });
      } else {
        Alert.alert('⚠️ Not Yet Verified', 'Please verify your email first.');
      }
    } catch (err) {
      console.log('❌ Check verification error:', err);
      Alert.alert('❌ Error', err.response?.data?.detail || 'Could not verify status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Please Verify Your Email</Text>
      <Text style={styles.subtitle}>
        We’ve sent a verification link to <Text style={styles.email}>{email}</Text>.
      </Text>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleResend}
        disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Resend Verification Email</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, isLoading && styles.disabledButton]}
        onPress={handleAlreadyVerified}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#4A6FA5" />
        ) : (
          <Text style={styles.secondaryButtonText}>If already verified, click here</Text>
        )}
      </TouchableOpacity>


      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4A6FA5',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    color: '#555',
    marginBottom: 25,
  },
  email: {
    fontWeight: 'bold',
    color: '#4A6FA5',
  },
  logoutButton: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutText: {
    color: '#ff6d6d',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#4A6FA5',
    padding: 12,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#4A6FA5',
    padding: 12,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4A6FA5',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
});