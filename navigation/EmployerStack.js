// navigation/EmployerStack.js
import React from 'react';
import { TouchableOpacity, Image } from 'react-native'; // Add Image import
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';


// Tabs
import EmployerDashboard from '../screens/Employer/EmployerDashboard'; // repurposed dashboard jobs section
import ApplicantTabScreen from '../screens/Employer/ApplicantTabScreen';
import EmployerProfileScreen from '../screens/Employer/EmployerProfileScreen'; // placeholder with logout

// Detail Screens
import JobApplicantList from '../screens/Employer/JobApplicantListScreen';
import ApplicantDetail from '../screens/Employer/ApplicantDetailScreen';
import JobCreationForm from '../screens/Employer/JobCreationFormScreen';
import JobEdit from '../screens/Employer/JobEditScreen';
import PostedJobDetail from '../screens/Employer/PostedJobDetailScreen';

// Shared
import NotificationsScreen from '../screens/Shared/NotificationsScreen';
import ProfileDetailScreen from '../screens/Shared/ProfileDetailScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';
import NotificationBell from "../components/NotificationBell"; 
import InterviewDetailScreen from '../screens/Shared/InterviewDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function EmployerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <Image 
            source={require('../assets/Rectangle-logo-white.png')} // Adjust path as needed
            style={styles.logo}
            resizeMode="contain"
          />
        ),
        headerRight: () => (
          <NotificationBell navigation={navigation} />
        ),
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Jobs') {
            iconName = 'briefcase-outline';
          } else if (route.name === 'Applicants') {
            iconName = 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = 'person-circle-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Jobs" 
        component={EmployerDashboard} 
        options={{ title: 'Jobs' }} 
      />
      <Tab.Screen 
        name="Applicants" 
        component={ApplicantTabScreen} 
        options={{ title: 'Applicants' }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={EmployerProfileScreen} 
        options={{ title: 'Profile' }} 
      />
    </Tab.Navigator>
  );
}







export default function EmployerStack() {
  return (
    <Stack.Navigator>
      {/* Main Tabs */}
      <Stack.Screen
        name="EmployerTabs"
        component={EmployerTabs}
        options={{ headerShown: false }}
      />

      {/* Detail Screens */}
      <Stack.Screen name="JobApplicantList" component={JobApplicantList} options={{ headerShown: true, title: 'Job Applicant List' }}/>
      <Stack.Screen name="ApplicantDetail" component={ApplicantDetail} options={{ headerShown: true, title: 'Applicant Detail' }} />
      <Stack.Screen name="JobCreationForm" component={JobCreationForm} options={{ headerShown: true, title: 'Job Creation Form' }} />
      <Stack.Screen name="JobEdit" component={JobEdit} options={{ headerShown: true, title: 'Edit Job Details' }} />
      <Stack.Screen name="PostedJobDetail" component={PostedJobDetail} options={{ headerShown: true, title: 'Posted Job Detail' }} />

      {/* Shared */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications Screen' }} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} options={{ headerShown: true, title: 'User Profile' }}/>
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} options={{ headerShown: true, title: 'Profile Settings' }}/>
      <Stack.Screen
        name="InterviewDetail"
        component={InterviewDetailScreen}
        options={{ headerShown: true, title: 'Interview Details' }}
      />

    </Stack.Navigator>
  );
}

const styles = {
  logo: {
    width: 160, // Adjust size as needed
    height: 90, // Adjust size as needed
  },
};