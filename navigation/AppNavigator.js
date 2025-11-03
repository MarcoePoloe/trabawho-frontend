import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Auth screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';

// Shared screens
import EmailVerificationPendingScreen from '../screens/Shared/EmailVerificationPendingScreen';

// Role-based stacks
import JobSeekerStack from './JobSeekerStack';
import EmployerStack from './EmployerStack';


const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {

      // await AsyncStorage.clear();
      console.log("🔍 Running auth check...");

      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");

      console.log("👉 token:", token);
      console.log("👉 role:", role);

      if (token && role) {
        console.log("✅ Logged in as:", role);
        setInitialRoute(role === "job-seeker" ? "JobSeekerStack" : "EmployerStack");
      } else {
        console.log("❌ No login found, going to Login screen");
        setInitialRoute("Login");
      }
    };

    checkAuth();
  }, []);
  
  console.log("🚀 Initial route is:", initialRoute);
  if (!initialRoute) return null; // wait for auth check before rendering

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      {/* Auth */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EmailVerificationPendingScreen"
        component={EmailVerificationPendingScreen}
        options={{ headerShown: false }}
      />

      {/* Role stacks */}
      <Stack.Screen
        name="JobSeekerStack"
        component={JobSeekerStack}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EmployerStack"
        component={EmployerStack}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
