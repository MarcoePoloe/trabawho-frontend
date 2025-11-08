// navigation/JobSeekerStack.js
import React from "react";
import { Image } from "react-native"; // Add Image import
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

// screen components (files may still be named *Screen.js — that's fine)
import JobSeekerDashboard from "../screens/JobSeeker/JobSeekerDashboard";
import JobDetailsScreen from "../screens/JobSeeker/JobDetailsScreen";
import ApplicationFormScreen from "../screens/JobSeeker/ApplicationFormScreen";
import ApplicationTabScreen from "../screens/JobSeeker/ApplicationTabScreen";
import ApplicationDetailsScreen from "../screens/JobSeeker/ApplicationDetailsScreen";
import JobSeekerProfileScreen from "../screens/JobSeeker/JobSeekerProfileScreen";
import AllAIMatchesScreen from "../screens/JobSeeker/AllAIMatchesScreen";

import InterviewDetailScreen from '../screens/Shared/InterviewDetailScreen';

import NotificationsScreen from "../screens/Shared/NotificationsScreen";
import ProfileDetailScreen from '../screens/Shared/ProfileDetailScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';
import NotificationBell from "../components/NotificationBell"; // top of file
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ---------- Nested stacks used as tab components (only the "home" list screens live here) ---------- */

function JobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* root list for Jobs tab */}
      <Stack.Screen name="JobsHome" component={JobSeekerDashboard} />
    </Stack.Navigator>
  );
}

function ApplicationsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* root list for Applications tab */}
      <Stack.Screen name="ApplicationsHome" component={ApplicationTabScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={JobSeekerProfileScreen} />
    </Stack.Navigator>
  );
}

/* ---------- Tab Navigator (Jobs / Applications / Profile) ---------- */

function JobSeekerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
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
        // tab bar icons
        tabBarIcon: ({ color, size }) => {
          let iconName = "help-circle-outline";
          if (route.name === "Jobs") iconName = "briefcase-outline";
          else if (route.name === "Applications") iconName = "document-text-outline";
          else if (route.name === "Profile") iconName = "person-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Jobs" component={JobsStack} options={{ title: "Jobs" }} />
      <Tab.Screen name="Applications" component={ApplicationsStack} options={{ title: "Applications" }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

/* ---------- Root stack: tabs are one screen, detail screens live here (so they hide tabs/header) ---------- */

export default function JobSeekerStack() {
  return (
    <Stack.Navigator>
      {/* tabs are mounted as a single screen */}
      <Stack.Screen name="Tabs" component={JobSeekerTabs} options={{ headerShown: false }} />

      {/* detail screens registered on the root stack (short route names) */}
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: "Job Details" }} />
      <Stack.Screen name="ApplicationForm" component={ApplicationFormScreen} options={{ title: "Apply" }} />
      <Stack.Screen name="ApplicationDetails" component={ApplicationDetailsScreen} options={{ title: "Application" }} />
      <Stack.Screen name="AllAIMatchesScreen" component={AllAIMatchesScreen} options={{ headerShown: true, title: 'AI Job Matches'}} />
      {/* shared modal/page */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
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
