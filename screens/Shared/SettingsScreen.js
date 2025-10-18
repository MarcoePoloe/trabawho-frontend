import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { postRequest, putWithForm } from '../../services/api';
import { useNavigation } from '@react-navigation/native';


export default function SettingsScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [changeEmailVisible, setChangeEmailVisible] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    const loadUserEmail = async () => {
      const storedEmail = await AsyncStorage.getItem('email');
      const token = await AsyncStorage.getItem('token');
      setEmail(storedEmail || '');
    };
    loadUserEmail();
  }, []);

const handleChangePassword = async () => {
  if (!currentPassword || !newPassword) {
    Alert.alert('Error', 'Please fill out all password fields.');
    return;
  }

  if (newPassword.length < 6) {
    Alert.alert('Error', 'New password must be at least 6 characters long.');
    return;
  }

  try {
    const form= new URLSearchParams();
    form.append('old_password', currentPassword);
    form.append('new_password', newPassword);

    // Use your helper that already includes the Bearer token
    const res = await putWithForm('/change-password', form.toString());

    const message =
      typeof res.data === 'object'
        ? res.data.message || 'Password changed successfully.'
        : 'Password changed successfully.';

    Alert.alert('Success', message);
    setChangePasswordVisible(false);
    setCurrentPassword('');
    setNewPassword('');
  } catch (error) {
  
    console.log('🔍 Sending PUT request to /change-password...');
    console.log('❌ Change password error:', error);
    const msg =
      error.response?.data?.detail || 'Failed to change password. Please try again.';
    Alert.alert('Error', msg);
  }
};



  const handleChangeEmail = async () => {
    if (!newEmail) {
      Alert.alert('Error', 'Please enter your new email.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const res = await postRequest('/request-email-change', {new_email: newEmail},  true);
      Alert.alert('Success', res.data.message || 'Email change request sent.');
      setChangeEmailVisible(false);
      setNewEmail('');
    } catch (error) {
  const detail = error.response?.data?.detail;
  const msg = Array.isArray(detail)
    ? detail.map(d => d.msg || '').join('\n')
    : detail || 'Failed to password email.';
  Alert.alert('Error', msg);
  console.log('❌ Change password error:', error);
}
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setLogoutVisible(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      {/* <Text style={styles.title}>Settings</Text> */}

      <View style={styles.infoCard}>
        <Text style={styles.label}>Sign-in Email</Text>
        <Text style={styles.value}>{email}</Text>
      </View>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => setChangePasswordVisible(true)}
      >
        <MaterialIcons name="lock-outline" size={22} color="#4A6FA5" />
        <Text style={styles.optionText}>Change Password</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => setChangeEmailVisible(true)}
      >
        <MaterialIcons name="email" size={22} color="#4A6FA5" />
        <Text style={styles.optionText}>Change Email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.optionButton, { marginTop: 30 }]}
        onPress={() => setLogoutVisible(true)}
      >
        <MaterialIcons name="logout" size={22} color="#d9534f" />
        <Text style={[styles.optionText, { color: '#d9534f' }]}>Logout</Text>
      </TouchableOpacity>

      {/* --- Change Password Modal --- */}
      <Modal visible={changePasswordVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              placeholder="Current Password"
              secureTextEntry
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              placeholder="New Password"
              secureTextEntry
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setChangePasswordVisible(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword}>
                <Text style={styles.confirmButton}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Change Email Modal --- */}
      <Modal visible={changeEmailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Change Email</Text>
            <TextInput
              placeholder="New Email"
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setChangeEmailVisible(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangeEmail}>
                <Text style={styles.confirmButton}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Logout Confirmation Modal --- */}
      <Modal visible={logoutVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to log out?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setLogoutVisible(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.confirmButton}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  label: {
    color: '#777',
    fontSize: 14,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  optionText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 15,
  },
  modalMessage: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  cancelButton: {
    fontSize: 16,
    color: '#777',
    marginRight: 20,
  },
  confirmButton: {
    fontSize: 16,
    color: '#4A6FA5',
    fontWeight: '700',
  },
});