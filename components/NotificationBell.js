// components/NotificationBell.js
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { getRequest } from "../services/api";
import { StyleSheet } from 'react-native';

export default function NotificationBell({ navigation }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const isFocused = useIsFocused(); // refresh whenever the tab/screen is active

  const fetchUnread = async () => {
    try {
      const res = await getRequest("/notifications?read=false");

      let notificationsData = [];
      if (res.data && res.data.notifications) {
        notificationsData = res.data.notifications;
      } else if (Array.isArray(res.data)) {
        notificationsData = res.data;
      }

      const unread = notificationsData.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.log("❌ Error fetching unread notifications:", err);
    }
  };

  // useEffect(() => {
  //   if (isFocused) fetchUnread(); // refresh when focused
  // }, [isFocused]);

  // Optional: auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TouchableOpacity
      style={{ marginRight: 15 }}
      onPress={() => navigation.navigate("Notifications")}
    >
      <Ionicons name="notifications-outline" size={24} color="#333" />
      {unreadCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: 4,
            backgroundColor: "#FF3B30",
            borderRadius: 8,
            width: 16,
            height: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Show count (optional small number) */}
          <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}