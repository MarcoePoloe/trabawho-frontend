// screens/Notifications/NotificationScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { getRequest, putRequest } from "../../services/api";
import { Ionicons } from "@expo/vector-icons";


export default function NotificationScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await getRequest("/notifications");
      console.log("📢 Notifications with job details:", res.data);
      
      let notificationsData = [];
      if (res.data && res.data.notifications) {
        notificationsData = res.data.notifications;
      } else if (Array.isArray(res.data)) {
        notificationsData = res.data;
      }
      
      setNotifications(notificationsData);
    } catch (error) {
      console.log("❌ Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await putRequest("/notifications/read-all", {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.log("❌ Error marking notifications read:", error);
    }
  };

  const handleNotificationPress = async (notification) => {
    try {
      if (!notification.is_read) {
        await putRequest(`/notifications/${notification.notification_id}/read`, {});
        setNotifications(prev =>
          prev.map(n =>
            n.notification_id === notification.notification_id
              ? { ...n, is_read: true }
              : n
          )
        );
      }
      
      // You can add navigation logic here based on notification type
      console.log("📱 Notification pressed:", notification.title);
      
    } catch (error) {
      console.log("❌ Error marking notification as read:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        !item.is_read && styles.unreadCard,
      ]}
      activeOpacity={0.8}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={item.is_read ? "notifications-outline" : "notifications"}
          size={24}
          color={item.is_read ? "#777" : "#4A6FA5"}
        />
        {!item.is_read && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        
        {/* Display job details if available */}
        {item.job_title && (
          <View style={styles.jobDetails}>
            <Text style={styles.jobTitle}>{item.job_title}</Text>
            <Text style={styles.companyName}>{item.company_name}</Text>
            {item.location && (
              <Text style={styles.location}>{item.location}</Text>
            )}
          </View>
        )}
        
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
        {!item.is_read && (
          <Text style={styles.unreadLabel}>Tap to mark as read</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4A6FA5" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Ionicons name="checkmark-done" size={24} color="#4A6FA5" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notification_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4A6FA5"]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No notifications yet.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    elevation: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    padding: 12,
    elevation: 1,
  },
  unreadCard: { 
    backgroundColor: "#E8F0FE",
    borderLeftWidth: 4,
    borderLeftColor: "#4A6FA5",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    width: 40,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600", color: "#333" },
  message: { fontSize: 14, color: "#555", marginVertical: 4 },
  jobDetails: {
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  jobTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  companyName: { fontSize: 13, color: "#666", marginTop: 2 },
  location: { fontSize: 12, color: "#888", marginTop: 2, fontStyle: 'italic' },
  date: { fontSize: 12, color: "#888", marginTop: 4 },
  unreadLabel: {
    fontSize: 11,
    color: "#4A6FA5",
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 40,
    fontSize: 16,
  },
});