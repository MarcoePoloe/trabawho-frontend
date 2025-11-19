// navigation/EmployerStack.js
import React from 'react';
import { Image, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Chat screens
import AllChatsScreen from "../screens/Chat/AllChatsScreen";
import ChatConversationScreen from "../screens/Chat/ChatConversationScreen";
import { useChat } from "../context/ChatContext";

// Tabs
import EmployerDashboard from '../screens/Employer/EmployerDashboard';
import ApplicantTabScreen from '../screens/Employer/ApplicantTabScreen';
import EmployerProfileScreen from '../screens/Employer/EmployerProfileScreen';

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

/* -----------------------------------------------------------
   Chat Stack (same pattern as JobSeeker's)
----------------------------------------------------------- */
function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatHome" component={AllChatsScreen} />
    </Stack.Navigator>
  );
}

function EmployerTabs() {
  const { unreadCount } = useChat();

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <Image
            source={require('../assets/Rectangle-logo-white.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        ),
        headerRight: () => <NotificationBell navigation={navigation} />,

        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Jobs') iconName = 'briefcase-outline';
          else if (route.name === 'Applicants') iconName = 'people-outline';
          else if (route.name === 'Messages') iconName = 'chatbubble-ellipses-outline';
          else if (route.name === 'Profile') iconName = 'person-circle-outline';

          return (
            <View style={{ width: 28, height: 28 }}>
              <Ionicons name={iconName} size={size} color={color} />

              {/* 🔴 Unread Badge */}
              {route.name === "Messages" && unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    backgroundColor: "red",
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Jobs" component={EmployerDashboard} />
      <Tab.Screen name="Applicants" component={ApplicantTabScreen} />

      {/* ⭐ NEW MESSAGES TAB ⭐ */}
      <Tab.Screen name="Messages" component={ChatStack} />

      <Tab.Screen name="Profile" component={EmployerProfileScreen} />
    </Tab.Navigator>
  );
}

/* -----------------------------------------------------------
   Root stack (same pattern as JobSeeker)
----------------------------------------------------------- */
export default function EmployerStack() {
  return (
    <Stack.Navigator>
      {/* Tabs */}
      <Stack.Screen
        name="EmployerTabs"
        component={EmployerTabs}
        options={{ headerShown: false }}
      />

      {/* Detail Screens */}
      <Stack.Screen name="JobApplicantList" component={JobApplicantList} options={{ title: 'Job Applicant List' }} />
      <Stack.Screen name="ApplicantDetail" component={ApplicantDetail} options={{ title: 'Applicant Detail' }} />
      <Stack.Screen name="JobCreationForm" component={JobCreationForm} options={{ title: 'Job Creation Form' }} />
      <Stack.Screen name="JobEdit" component={JobEdit} options={{ title: 'Edit Job Details' }} />
      <Stack.Screen name="PostedJobDetail" component={PostedJobDetail} options={{ title: 'Posted Job Detail' }} />

      {/* Shared */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="InterviewDetail" component={InterviewDetailScreen} />

      {/* ⭐ Chat conversation screen ⭐ */}
      <Stack.Screen
        name="ChatConversation"
        component={ChatConversationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const styles = {
  logo: {
    width: 160,
    height: 90,
  },
};
