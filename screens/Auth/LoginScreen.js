import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Image,
  Keyboard
} from 'react-native';


import { Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postRequest,getRequest } from '../../services/api';
import { BackHandler } from 'react-native';

export default function LoginScreen() {
  const [userType, setUserType] = useState('job-seeker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isForgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const navigation = useNavigation();

  // Validation helpers
  const validateEmail = (email) => {
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email';
    return '';
  };

  const validatePassword = (password) => {
    const trimmed = password.trim();
    if (!trimmed) return 'Password is required';
    if (trimmed.length < 6) return 'Must be at least 6 characters';
    return '';
  };

  const validateForm = () => {
    const e = validateEmail(email);
    const p = validatePassword(password);
    setErrors({ email: e, password: p });
    return !e && !p;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const url = userType === 'job-seeker' ? '/login/job-seeker' : '/login/employer';
      const response = await postRequest(url, {
        email: email.trim(),
        password: password.trim(),
      }, true);

      await AsyncStorage.setItem('token', String(response.data.access_token));
      await AsyncStorage.setItem('role', userType);
      await AsyncStorage.setItem("email", email);
      const verifyRes = await getRequest('/check-verification', { email: email, role: userType }, true);
      const verified = verifyRes.data?.is_verified;

      if (!verified) {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before logging in.',
          [{ text: 'OK', onPress: () => navigation.navigate('EmailVerificationPendingScreen', { email: email.trim(), role: userType }) }]
        );
        return;
      }
      
      navigation.reset({
        index: 0,
        routes: [{ name: userType === 'job-seeker' ? 'JobSeekerStack' : 'EmployerStack' }],
      });
    } catch (error) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials.');
      console.log('❌ Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
  if (!forgotEmail.trim()) {
    Alert.alert("Missing Email", "Please enter your email address.");
    return;
  }

  setIsForgotLoading(true);
  try {
    const endpoint = '/forgot-password';
    const data = {
      email: forgotEmail.trim(),
      role: userType === 'job-seeker' ? 'job_seeker' : 'employer',
    };

    const response = await postRequest(endpoint, data, true);

    Alert.alert(
      "Reset Link Sent",
      response.data?.message || "A password reset link has been sent to your email."
    );

    setForgotModalVisible(false);
    setForgotEmail('');
  } catch (error) {
    console.error("❌ Forgot Password Error:", error);
    Alert.alert(
      "Error",
      error.response?.data?.detail ||
        "We couldn’t send the reset link. Please check your email and try again."
    );
  } finally {
    setIsForgotLoading(false);
  }
};

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
             <Image 
    source={require('../../assets/Rectangle-logo.png')} // Adjust the path if needed
    style={styles.logo}
    resizeMode="contain"
  />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Login as {userType === 'job-seeker' ? 'Job Seeker' : 'Employer'}
            </Text>

            {/* Email */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                placeholder="Email address"
                placeholderTextColor="#999"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
                returnKeyType="next"
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            {/* Password */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor="#999"
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                disabled={isLoading}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <TouchableOpacity
              onPress={() => setForgotModalVisible(true)}
              style={{ alignSelf: 'center', marginBottom: 15 }}
            >
              <Text style={{ color: '#5271ff', fontSize: 14, fontWeight: '500' }}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.primaryButton, (errors.email || errors.password) && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading || !!errors.email || !!errors.password}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#f5f5f5" />
              ) : (
                <Text style={styles.primaryButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Switch User Type */}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setUserType(userType === 'job-seeker' ? 'employer' : 'job-seeker')}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.switchButtonText}>
                {userType === 'job-seeker'
                  ? 'Are you an Employer? Login here'
                  : 'Are you a Job Seeker? Login here'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={isLoading}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
          {/* Forgot Password Modal */}
<Modal
  animationType="slide"
  transparent={true}
  visible={isForgotModalVisible}
  onRequestClose={() => setForgotModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <Text style={styles.modalTitle}>Reset Password</Text>
      <Text style={styles.modalSubtitle}>
        Enter your email to receive a reset link.
      </Text>

      <TextInput
        placeholder="Enter your email"
        placeholderTextColor="#999"
        style={styles.modalInput}
        value={forgotEmail}
        onChangeText={setForgotEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.modalButtonRow}>
        <TouchableOpacity
          style={[styles.modalButton, { backgroundColor: '#ccc' }]}
          onPress={() => setForgotModalVisible(false)}
          disabled={isForgotLoading}
        >
          <Text style={styles.modalButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modalButton, { backgroundColor: '#5271ff' }]}
          onPress={handleForgotPassword}
          disabled={isForgotLoading}
        >
          {isForgotLoading ? (
            <ActivityIndicator color="#f5f5f5" />
          ) : (
            <Text style={[styles.modalButtonText, { color: '#f5f5f5' }]}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: {
  width: 400, // Adjust size as needed
  height: 180, // Adjust size as needed
  marginBottom: 10,
  borderRadius: 8, // Optional: if you want slightly rounded corners
},
  welcomeText: { fontSize: 22, color: '#666' },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#5271ff', marginTop: 5 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  inputIcon: { marginRight: 10 },
  input: { height: 50, fontSize: 16, color: '#333', flex: 1 },
  eyeIcon: { padding: 10 },
  primaryButton: {
    backgroundColor: '#5271ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: { color: '#f5f5f5', fontSize: 18, fontWeight: '600' },
  disabledButton: { backgroundColor: '#ccc', opacity: 0.7 },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchButtonText: { color: '#5271ff', fontSize: 14, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#666', fontSize: 14 },
  footerLink: { color: '#5271ff', fontSize: 14, fontWeight: '600', marginLeft: 5 },
  errorText: { color: '#ff5252', fontSize: 12, marginBottom: 10, marginLeft: 10 },
  modalOverlay: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
},
modalContainer: {
  backgroundColor: '#f5f5f5',
  borderRadius: 12,
  padding: 25,
  width: '85%',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 5,
  elevation: 5,
},
modalTitle: {
  fontSize: 20,
  fontWeight: '600',
  color: '#333',
  marginBottom: 8,
},
modalSubtitle: {
  fontSize: 14,
  color: '#666',
  marginBottom: 20,
  textAlign: 'center',
},
modalInput: {
  width: '100%',
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 8,
  paddingHorizontal: 15,
  paddingVertical: 12,
  fontSize: 16,
  color: '#333',
  marginBottom: 20,
},
modalButtonRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: '100%',
},
modalButton: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginHorizontal: 5,
},
modalButtonText: {
  fontSize: 16,
  fontWeight: '600',
},

});
