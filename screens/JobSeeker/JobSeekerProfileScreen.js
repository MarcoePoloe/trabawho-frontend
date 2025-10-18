// screens/JobSeeker/JobSeekerProfileTabScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { getRequest, putWithAuth } from '../../services/api';
import { uploadFile } from '../../services/upload';
import { useNavigation } from '@react-navigation/native';


export default function JobSeekerProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [resume, setResume] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const navigation = useNavigation();

  // fetch profile info
  const fetchProfileData = useCallback(async () => {
    setRefreshing(true);
    try {
      const meRes = await getRequest('/me');
      const id =
        meRes?.data?.job_seeker_id ||
        meRes?.data?.employer_id ||
        meRes?.data?.user_id ||
        meRes?.data?.id;

      const profileRes = await getRequest('/GetProfileInfo/me');
      setProfile(profileRes.data || {});
      setEditData(profileRes.data || {});

      const resumeRes = await getRequest('/resumes/me');
      setResume(Boolean(resumeRes.data?.has_resume));
    } catch (err) {
      console.error('❌ Error fetching profile data:', err);
      Toast.show({ type: 'error', text1: 'Failed to load profile' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // upload profile photo
  const handlePhotoChange = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploadingPhoto(true);
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || 'profile.jpg',
        type: asset.mimeType || 'image/jpeg',
      });

      const token = await AsyncStorage.getItem('token');
      await putWithAuth('/PutProfileInfo/Photo', formData, token, true);
      Toast.show({ type: 'success', text1: 'Profile photo updated!' });
      await fetchProfileData();
    } catch (err) {
      console.error('❌ Photo upload failed:', err);
      Toast.show({ type: 'error', text1: 'Photo upload failed' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // save profile info
  const handleSaveProfile = async () => {
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) return Toast.show({ type: 'error', text1: 'Not authenticated' });

      const fd = new FormData();
      const maybeAppend = (key, value) => {
        if (value !== undefined && value !== null && value !== '') fd.append(key, value);
      };

      maybeAppend('name', editData.name);
      maybeAppend('bio', editData.bio);
      if (editData.birthdate) {
        let bd = editData.birthdate;
        if (bd instanceof Date) bd = bd.toISOString().split('T')[0];
        maybeAppend('birthdate', bd);
      }
      maybeAppend('location', editData.location);
      maybeAppend('contact_info', editData.contact_info);
      maybeAppend('contact_email', editData.contact_email);

      await putWithAuth('/PutProfileInfo', fd, token, true);
      Toast.show({ type: 'success', text1: 'Profile updated successfully!' });
      setEditing(false);
      await fetchProfileData();
    } catch (err) {
      console.error('❌ Save failed:', err);
      Toast.show({ type: 'error', text1: 'Failed to save profile info' });
    } finally {
      setBusy(false);
    }
  };

  // upload resume
  const handleUploadResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled || !result.assets?.length) return;

      setUploadingResume(true);
      const file = result.assets[0];
      await uploadFile(file);
      Toast.show({ type: 'success', text1: 'Resume uploaded successfully!' });
      await fetchProfileData();
    } catch (err) {
      console.error('❌ Resume upload failed:', err);
      Toast.show({ type: 'error', text1: 'Resume upload failed' });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleViewResume = async () => {
    try {
      const res = await getRequest('/resumes/me');
      const url = res.data?.resume?.url || res.data?.signed_url;
      if (!url) return Toast.show({ type: 'info', text1: 'No resume available' });
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.error('❌ View resume failed:', err);
      Toast.show({ type: 'error', text1: 'Failed to open resume' });
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (!profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5271ff" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfileData} />}
    >
      <View style={styles.card}>
        {/* Settings Button - Top Right Corner */}
        <TouchableOpacity
          onPress={() => navigation.navigate('SettingsScreen')}
          style={styles.settingsButton}
          activeOpacity={0.8}
        >
          <MaterialIcons name="settings" size={26} color="#5271ff" />
        </TouchableOpacity>

        {/* Profile Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.photoContainer}>
            <TouchableOpacity onPress={() => setShowImageModal(true)}>
              {uploadingPhoto ? (
                <View style={styles.loadingPhotoContainer}>
                  <ActivityIndicator size="large" color="#5271ff" />
                </View>
              ) : (
                <Image source={{ uri: profile.photo_url }} style={styles.profilePhoto} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.editIconContainer} onPress={handlePhotoChange}>
              <MaterialIcons name="edit" size={20} color="#5271ff" />
            </TouchableOpacity>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name || 'Unnamed'}</Text>
            
          </View>

          <Text style={styles.bio}>{profile.bio || 'No bio yet.'}</Text>
        </View>

        {/* Profile Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Home Address</Text>
              <Text style={styles.infoText}>{profile.location || 'Not specified'}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date of Birth</Text>
              <Text style={styles.infoText}>{profile.birthdate || 'Not specified'}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contact Info</Text>
              <Text style={styles.infoText}>{profile.contact_info || 'Not specified'}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoText}>{profile.contact_email || 'Not specified'}</Text>
            </View>

            <TouchableOpacity style={styles.editProfileButton} onPress={() => setEditing(true)}>
                            <MaterialIcons name="edit" size={18} color="#fff" />
                            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
                          </TouchableOpacity>
          </View>
        </View>

        {/* Resume Section */}
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resume</Text>
          {uploadingResume ? (
            <ActivityIndicator size="small" color="#5271ff" />
          ) : resume ? (
            <View style={styles.resumeButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleViewResume}>
                <Text style={styles.primaryButtonText}>View Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={handleUploadResume}>
                <Text style={styles.outlineButtonText}>Upload New Resume</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleUploadResume}>
              <Text style={styles.primaryButtonText}>Upload Resume</Text>
            </TouchableOpacity>
          )}
        </View> */}

       
       
      </View>
      
      <Text style={styles.space}></Text>
      <View style={styles.card}>
            <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resume</Text>
          {uploadingResume ? (
            <ActivityIndicator size="small" color="#5271ff" />
          ) : resume ? (
            <View style={styles.resumeButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleViewResume}>
                <Text style={styles.primaryButtonText}>View Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={handleUploadResume}>
                <Text style={styles.outlineButtonText}>Upload New Resume</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleUploadResume}>
              <Text style={styles.primaryButtonText}>Upload Resume</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>


      {/* Fullscreen photo view */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalBackdrop}
            onPress={() => setShowImageModal(false)}
          />
          <Image source={{ uri: profile.photo_url }} style={styles.imageModalPhoto} />
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <ScrollView>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={editData.name}
                onChangeText={(t) => setEditData({ ...editData, name: t })}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Bio"
                value={editData.bio}
                onChangeText={(t) => setEditData({ ...editData, bio: t })}
                multiline
              />
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <TextInput
                  style={styles.input}
                  placeholder="Birthdate"
                  editable={false}
                  value={editData.birthdate || ''}
                />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={editData.birthdate ? new Date(editData.birthdate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(e, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate)
                      setEditData({
                        ...editData,
                        birthdate: selectedDate.toISOString().split('T')[0],
                      });
                  }}
                />
              )}
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={editData.location}
                onChangeText={(t) => setEditData({ ...editData, location: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact Info"
                value={editData.contact_info}
                onChangeText={(t) => setEditData({ ...editData, contact_info: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact Email"
                value={editData.contact_email}
                onChangeText={(t) => setEditData({ ...editData, contact_email: t })}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={busy}>
                <Text style={styles.saveButtonText}>{busy ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Toast />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
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
    position: 'relative', // Added for absolute positioning of settings button
  },
  editProfileButton: {
  backgroundColor: '#5271ff',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 8,
  marginTop: 10,
  alignSelf: 'center',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
editProfileButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
  settingsButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
    padding: 5,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 20,
    marginTop: 10, // Added to give space for the settings button
  },
  space: {
    fontSize: 5,
    color: '#666',
  },
  photoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  profilePhoto: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#5271ff',
  },
  loadingPhotoContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  editIconContainer: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#5271ff',
    elevation: 3,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  bio: {
    textAlign: 'left',
    color: '#555',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  infoGrid: {
    gap: 15,
  },
  infoItem: {
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5271ff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: '#444',
    lineHeight: 20,
  },
  resumeButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#5271ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    borderColor: '#5271ff',
    borderWidth: 1.5,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#5271ff',
    fontSize: 16,
    fontWeight: '600',
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
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageModalPhoto: {
    width: '85%',
    height: '55%',
    resizeMode: 'contain',
    borderRadius: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#5271ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
  },
  cancelText: {
    color: '#5271ff',
    fontSize: 16,
    fontWeight: '600',
  },
});