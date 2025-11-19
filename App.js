import 'react-native-gesture-handler';
import React from 'react';
import Toast from 'react-native-toast-message';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation/AppNavigator';
import { enableScreens } from 'react-native-screens';
import { ChatProvider } from "./context/ChatContext";
import { StyleSheet } from 'react-native';
enableScreens(true);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>

      <NavigationContainer>
        <ChatProvider>
          <AppNavigator />
        </ChatProvider>
      </NavigationContainer>
      <Toast>
      </Toast>
    </GestureHandlerRootView>



  );
}




