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
import LocationPicker from "../../components/LocationPicker";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { getRequest, putWithAuth } from '../../services/api';
import { uploadFile } from '../../services/upload';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from "react-native-maps";
import * as Linking from "expo-linking";
import { Platform } from "react-native";


export default function JobSeekerProfileScreen() {
  const [profile, setProfile] = useState({});
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
  const [locationData, setLocationData] = useState({
    latitude: null,
    longitude: null,
    geocoded_address: "",
  });


  // fetch profile info
  const fetchProfileData = useCallback(async () => {
    setRefreshing(true);
    try {
      // fetch current user (to validate token or role if needed)
      const meRes = await getRequest('/me').catch(() => null);
      // attempt to get profile info
      const profileRes = await getRequest('/GetProfileInfo/me').catch(() => null);
      const profileData = profileRes?.data ?? {};

      // safe resume check
      const resumeRes = await getRequest('/resumes/me').catch(() => null);
      const hasResume =
        Boolean(resumeRes?.data?.has_resume) ||
        Boolean(resumeRes?.data?.resume) ||
        Boolean(resumeRes?.data?.signed_url);

      setProfile(profileData);
      setEditData(profileData);
      setResume(Boolean(hasResume));
    } catch (err) {
      console.error('❌ Error fetching profile data:', err);
      Toast.show({ type: 'error', text1: 'Failed to load profile' , visibilityTime: 4000,});
      setProfile({});
      setEditData({});
      setResume(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    if (profile) {
      setLocationData({
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
        geocoded_address: profile.geocoded_address ?? "",
      });
    }
  }, [profile]);


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
      Toast.show({ type: 'success', text1: 'Profile photo updated!', visibilityTime: 4000, });
      await fetchProfileData();
    } catch (err) {
      console.log('❌ Photo upload failed:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      Toast.show({ type: 'error', text1: 'Photo upload failed', visibilityTime: 4000, });
    }
    finally {
      setUploadingPhoto(false);
    }
  };

  // save profile info
  const handleSaveProfile = async () => {
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Toast.show({ type: 'error', text1: 'Not authenticated' , visibilityTime: 4000,});
        return;
      }

      const fd = new FormData();
      const maybeAppend = (key, value) => {
        if (value !== undefined && value !== null && value !== '') fd.append(key, value);
      };

      maybeAppend('name', editData?.name);
      maybeAppend('bio', editData?.bio);
      if (editData?.birthdate) {
        let bd = editData.birthdate;
        if (bd instanceof Date) bd = bd.toISOString().split('T')[0];
        maybeAppend('birthdate', bd);
      }
      maybeAppend('location', editData?.location);
      maybeAppend('contact_info', editData?.contact_info);
      maybeAppend('contact_email', editData?.contact_email);
      maybeAppend('years_of_experience', editData?.years_of_experience);

      maybeAppend("latitude", locationData.latitude);
      maybeAppend("longitude", locationData.longitude);
      maybeAppend("geocoded_address", locationData.geocoded_address);

      await putWithAuth('/PutProfileInfo', fd, token, true);
      Toast.show({ type: 'success', text1: 'Profile updated successfully!', visibilityTime: 4000, });
      setEditing(false);
      await fetchProfileData();
    } catch (err) {
      console.error('❌ Save failed:', err);
      Toast.show({ type: 'error', text1: 'Failed to save profile info', visibilityTime: 4000, });
    } finally {
      setBusy(false);
    }
  };

  // upload resume
  const handleUploadResume = async () => {
    try {
      console.log('📁 Starting resume upload process...');

      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      console.log('📄 Document picker result:', result);

      // FIX: Check for canceled property instead of type
      if (result.canceled) {
        console.log('❌ Document picker cancelled');
        return;
      }

      // FIX: Also check if we have assets
      if (!result.assets || result.assets.length === 0) {
        console.log('❌ No file selected');
        return;
      }

      setUploadingResume(true);

      // FIX: Get the first asset from the assets array
      const asset = result.assets[0];
      const fileObj = {
        uri: asset.uri,
        name: asset.name || 'resume.pdf',
        type: asset.mimeType || 'application/pdf',
      };

      console.log('📦 File object prepared:', fileObj);
      console.log('🚀 Calling uploadFile helper...');

      await uploadFile(fileObj);

      console.log('✅ Resume upload successful!');
      Toast.show({ type: 'success', text1: 'Resume uploaded successfully!' , visibilityTime: 4000,});
      await fetchProfileData();

    } catch (err) {
      console.error('❌ Resume upload failed:', err);
      console.log('❌ Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      Toast.show({ type: 'error', text1: 'Resume upload failed: ' + (err.message || 'Unknown error') , visibilityTime: 4000,});
    } finally {
      setUploadingResume(false);
    }
  };
  const handleViewResume = async () => {
    try {
      const res = await getRequest('/resumes/me');
      // backend may return different shapes - try several
      const url =
        res?.data?.resume?.url ||
        res?.data?.signed_url ||
        res?.data?.url ||
        (res?.data?.resume && (res.data.resume.url || res.data.resume.signed_url));

      if (!url) {
        Toast.show({ type: 'info', text1: 'No resume available', visibilityTime: 4000, });
        return;
      }

      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.error('❌ View resume failed:', err);
      Toast.show({ type: 'error', text1: 'Failed to open resume', visibilityTime: 4000, });
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // Render loading if profile hasn't loaded yet — but we ensure profile is an object
  if (!profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5271ff" />
      </View>
    );
  }

  // safe accessor helpers
  const safe = (val, fallback = '') => (val !== undefined && val !== null ? val : fallback);
  const profilePhotoUri = safe(profile.photo_url, null);

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
            <TouchableOpacity onPress={() => profilePhotoUri && setShowImageModal(true)}>
              {uploadingPhoto ? (
                <View style={styles.loadingPhotoContainer}>
                  <ActivityIndicator size="large" color="#5271ff" />
                </View>
              ) : profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePhoto} />
              ) : (
                // Placeholder circle with initials or icon
                <View style={[styles.profilePhoto, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef4ff' }]}>
                  <Text style={{ color: '#5271ff', fontWeight: '700', fontSize: 28 }}>
                    {((profile?.name || '').split(' ').map(s => s[0]).slice(0, 2).join('')) || 'JS'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.editIconContainer} onPress={handlePhotoChange}>
              <MaterialIcons name="edit" size={20} color="#5271ff" />
            </TouchableOpacity>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{safe(profile.name, 'Unnamed')}</Text>
          </View>

          <Text style={styles.bio}>{safe(profile.bio, 'No bio yet.')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialities and Experience</Text>

          {/* Years of Experience */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Years of Experience</Text>
            <Text style={styles.infoText}>
              {profile.years_of_experience != null
                ? `${profile.years_of_experience} year(s)`
                : 'Not specified'}
            </Text>
          </View>

          {/* Skills / Specialities */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Specialities</Text>

            {!profile.skills || profile.skills.length === 0 ? (
              <Text style={styles.infoText}>No skills detected (Upload resume)</Text>
            ) : (
              <View style={styles.skillContainer}>
                {profile.skills.map((skill, index) => (
                  <View key={index} style={styles.skillBadge}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        {/* Profile Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Home Address</Text>
              <Text style={styles.infoText}>{safe(profile.location, 'Not specified')}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Home Address</Text>
              <Text style={styles.infoText}>{safe(profile.location, 'Not specified')}</Text>
            </View>

            {/* Map Location - Tight spacing like above */}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Map Location</Text>
              {profile.latitude && profile.longitude ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    const url = Platform.select({
                      ios: `http://maps.apple.com/?ll=${profile.latitude},${profile.longitude}`,
                      android: `https://www.google.com/maps/search/?api=1&query=${profile.latitude},${profile.longitude}`
                    });
                    Linking.openURL(url);
                  }}
                >
                  <Text style={{ color: "#444", fontSize: 12, marginBottom: 2 }}>
                    Tap to view in Maps
                  </Text>
                  <MapView
                    style={{
                      height: 150,
                      width: "100%",
                      borderRadius: 10,
                      marginTop: 0,
                    }}
                    initialRegion={{
                      latitude: profile.latitude,
                      longitude: profile.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: profile.latitude,
                        longitude: profile.longitude,
                      }}
                    />
                  </MapView>
                  <Text style={[styles.infoText, { color: "#444", fontSize: 14, marginTop: 4 }]}>
                    {safe(profile.geocoded_address || profile.location, 'Not specified')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{
                  height: 150,
                  width: "100%",
                  backgroundColor: "#f0f0f0",
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{ color: "#777" }}>📍 No location set</Text>
                  <Text style={{ color: "#5271ff", fontSize: 12 }}>
                    Edit profile to add location
                  </Text>
                </View>
              )}
            </View>


            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date of Birth</Text>
              <Text style={styles.infoText}>{safe(profile.birthdate, 'Not specified')}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contact Info</Text>
              <Text style={styles.infoText}>{safe(profile.contact_info, 'Not specified')}</Text>
            </View>


            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoText}>{safe(profile.contact_email, 'Not specified')}</Text>
            </View>

            <TouchableOpacity style={styles.editProfileButton} onPress={() => { setEditing(true); setEditData(profile || {}); }}>
              <MaterialIcons name="edit" size={18} color="#fff" />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
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
          <TouchableOpacity style={styles.imageModalBackdrop} onPress={() => setShowImageModal(false)} />
          {profilePhotoUri ? (
            <Image source={{ uri: profilePhotoUri }} style={styles.imageModalPhoto} />
          ) : (
            <View style={[styles.imageModalPhoto, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#fff' }}>No photo</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <ScrollView>
              <Text style={styles.infoLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={editData?.name ?? ''}
                onChangeText={(t) => setEditData({ ...editData, name: t })}
              />

              <Text style={styles.infoLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Bio"
                value={editData?.bio ?? ''}
                onChangeText={(t) => setEditData({ ...editData, bio: t })}
                multiline
              />

              <Text style={styles.infoLabel}>Birthdate</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <TextInput
                  style={styles.input}
                  placeholder="Birthdate"
                  editable={false}
                  value={editData?.birthdate ?? ''}
                />

              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={editData?.birthdate ? new Date(editData.birthdate) : new Date()}
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
              <Text style={styles.infoLabel}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={editData?.location ?? ''}
                onChangeText={(t) => setEditData({ ...editData, location: t })}
              />

              <Text style={styles.infoLabel}>Geolocation</Text>

              <LocationPicker
                initialLocation={{
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                }}
                onLocationPicked={(loc) => {
                  setLocationData({
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    geocoded_address: loc.geocoded_address,
                  });

                  // setEditData({
                  //   ...editData,
                  //   location: loc.geocoded_address, // keep text updated too
                  // });
                }}
              />
              
              <Text style={styles.infoLabel}>Contact Info</Text>
              <TextInput
                style={styles.input}
                placeholder="Contact Info"
                value={editData?.contact_info ?? ''}
                onChangeText={(t) => setEditData({ ...editData, contact_info: t })}
              />

              <Text style={styles.infoLabel}>Contact Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Contact Email"
                value={editData?.contact_email ?? ''}
                onChangeText={(t) => setEditData({ ...editData, contact_email: t })}
              />

              {/* Years of Experience */}
              <Text style={styles.infoLabel}>Years of Experience</Text>
              <TextInput
                style={styles.input}
                placeholder="Years of Experience"
                keyboardType="numeric"
                value={
                  editData?.years_of_experience != null
                    ? String(editData.years_of_experience)
                    : ''
                }
                onChangeText={(t) =>
                  setEditData({
                    ...editData,
                    years_of_experience: t.replace(/[^0-9]/g, ''),
                  })
                }
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
  skillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  skillBadge: {
    backgroundColor: '#5271ff20',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#5271ff60',
  },
  skillText: {
    color: '#5271ff',
    fontWeight: '600',
  },

});
