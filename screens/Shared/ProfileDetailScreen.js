// screens/Shared/ProfileDetailScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { getRequest } from '../../services/api';
import { MaterialIcons } from '@expo/vector-icons';


export default function ProfileDetailScreen({ route, navigation }) {
  const { user_id } = route.params;
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user_id) return Alert.alert('Error', 'User ID not provided');
    setRefreshing(true);
    try {
      const res = await getRequest(`/GetProfileInfo/${user_id}`);
      setProfile(res.data || {});
    } catch (err) {
      console.error('❌ Error fetching public profile:', err);
      Alert.alert('Error', 'Failed to load user profile');
      setProfile({});
    } finally {
      setRefreshing(false);
    }
  }, [user_id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (!profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A6FA5" />
      </View>
    );
  }

  // Fallback values
  const name = profile.name || profile.company_name || 'Unnamed User';
  const role = profile.role ? 'Employer' : 'Job Seeker';
  const bio = profile.bio || 'No bio yet.';
  const photo = profile.photo_url || 'https://via.placeholder.com/150';
  const birthdate = profile.birthdate || 'Not specified';
  const location = profile.location || 'Not specified';
  const contactInfo = profile.contact_info || 'Not specified';
  const contactEmail = profile.contact_email || 'Not specified';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfile} />}
    >
      <View style={styles.card}>
        {/* Profile Header Section - Keeping the horizontal layout */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => setShowImageModal(true)}>
            <Image source={{ uri: photo }} style={styles.profilePhoto} />
          </TouchableOpacity>

          <View style={styles.profileTextContainer}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.role}>{role}</Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bio}>{bio}</Text>
        </View>

        {/* Profile Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date of Birth</Text>
              <Text style={styles.infoText}>{birthdate}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoText}>{location}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contact Info</Text>
              <Text style={styles.infoText}>{contactInfo}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoText}>{contactEmail}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Full-screen photo modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalBackdrop}
            onPress={() => setShowImageModal(false)}
          />
          <Image source={{ uri: photo }} style={styles.imageModalPhoto} />
        </View>
      </Modal>
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
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 20,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#4A6FA5',
  },
  profileTextContainer: { 
    marginLeft: 20, 
    flex: 1,
    flexShrink: 1 
  },
  name: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#333',
    marginBottom: 4,
  },
  role: { 
    fontSize: 16, 
    color: '#4A6FA5',
    fontWeight: '600',
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
  bio: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
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
    color: '#4A6FA5',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: '#444',
    lineHeight: 20,
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
});