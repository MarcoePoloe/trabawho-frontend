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
import { getRequest, postRequest } from '../../services/api';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

export default function ProfileDetailScreen({ route, navigation }) {
  const { user_id } = route.params;
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [startingThread, setStartingThread] = useState(false);

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
  const role = profile.role === 'job_seeker' ? 'job_seeker' : 'employer'; // role for API
  const prettyRole = profile.role === 'job_seeker' ? 'Job Seeker' : 'Employer';
  const bio = profile.bio || 'No bio yet.';
  const photo = profile.photo_url || 'https://via.placeholder.com/150';
  const birthdate = profile.birthdate || 'Not specified';
  const location = profile.location || 'Not specified';
  const contactInfo = profile.contact_info || 'Not specified';
  const contactEmail = profile.contact_email || 'Not specified';
  // Job Seeker–specific fields
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const yearsOfExperience = profile.years_of_experience ?? null;


  // -----------------------------------------------------
  // 🚀 START A THREAD AND NAVIGATE TO CHAT
  // -----------------------------------------------------
  const handleSendMessage = async () => {
    if (!user_id) return Alert.alert('Error', 'No user selected.');

    setStartingThread(true);
    try {
      const payload = {
        recipient_id: user_id,
        recipient_role: role,
      };

      const res = await postRequest('/chat/start', payload);
      const data = res?.data;

      if (!data?.thread_id) {
        Alert.alert('Error', 'Unable to start chat.');
        return;
      }

      // Navigate to chat screen
      navigation.navigate('ChatConversation', {
        thread_id: data.thread_id,
        other_user_id: user_id,
        other_name: name,
        other_role: role,
        other_photo: photo,
      });

    } catch (err) {
      console.log('❌ Error starting thread:', err);
      Alert.alert('Error', 'Failed to start conversation.');
    } finally {
      setStartingThread(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfile} />}
    >
      <View style={styles.card}>

        {/* Profile Header Section */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => setShowImageModal(true)}>
            <Image source={{ uri: photo }} style={styles.profilePhoto} />
          </TouchableOpacity>

          <View style={styles.profileTextContainer}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.role}>{prettyRole}</Text>

            {/* ----------------------------------------------------
                SEND MESSAGE BUTTON
            ---------------------------------------------------- */}
            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleSendMessage}
              disabled={startingThread}
            >
              {startingThread ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
              )}

              <Text style={styles.messageButtonText}>
                {startingThread ? 'Opening...' : 'Send Message'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bio}>{bio}</Text>
        </View>

        {/* ==========================================================
                JOB SEEKER–ONLY SECTION: Skills + Experience
            ========================================================== */}
        {role === 'job_seeker' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Seeker Details</Text>

            {/* Years of Experience */}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Years of Experience</Text>
              <Text style={styles.infoText}>
                {yearsOfExperience !== null ? `${yearsOfExperience} year(s)` : 'Not specified'}
              </Text>
            </View>

            {/* Skills / Specialities */}
            <View style={{ marginTop: 10 }}>
              <Text style={styles.infoLabel}>Specialities</Text>

              {skills.length === 0 ? (
                <Text style={styles.infoText}>No skills found (upload a resume to update)</Text>
              ) : (
                <View style={styles.skillContainer}>
                  {skills.map((skill, index) => (
                    <View key={index} style={styles.skillBadge}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* =====================================================================
                EMPLOYER–ONLY SECTION: Company Details
            ===================================================================== */}
        {role === 'employer' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Company Details</Text>

            {/* Industry */}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Industry</Text>
              <Text style={styles.infoText}>
                {profile.industry ? profile.industry : 'Not specified'}
              </Text>
            </View>

            {/* Work Setup Policy */}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Work Setup Policy</Text>
              <Text style={styles.infoText}>
                {profile.work_setup_policy === 'onsite'
                  ? 'Onsite'
                  : profile.work_setup_policy === 'hybrid'
                    ? 'Hybrid'
                    : profile.work_setup_policy === 'remote_friendly'
                      ? 'Remote Friendly'
                      : 'Not specified'}
              </Text>
            </View>
          </View>
        )}

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
    borderColor: '#5271ff',
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
    // color: '#4A6FA5',
    color: '#5271ff',

    fontWeight: '600',
    marginBottom: 10,
  },

  /* ✨ NEW BUTTON STYLES */
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5271ff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 10,
    width: '70%',
    justifyContent: 'center',
  },
  messageButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 15,
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
    color: '#5271ff',
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
  skillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
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
