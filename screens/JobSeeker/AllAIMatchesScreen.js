import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRequest } from "../../services/api";

export default function AllAIMatchesScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await getRequest(`/match-jobs`, token);

      const rawMatches = res.data?.matches || res.data || [];

      const formatted = rawMatches.map((job) => ({
        ...job,
        match_percentage: job.match_percentage ?? 0,
      }));

      setJobs(formatted);
    } catch (error) {
      console.error("❌ Error fetching matches:", error);
      Alert.alert("Error", "Unable to load AI matches. Please try again.");
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMatches();
  }, []);

  const renderJob = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("JobDetails", {
          job_id: item.job_id,
          rating: item.match_percentage,
        })
      }
    >
      <Text style={styles.jobTitle}>{item.title}</Text>
      <Text style={styles.company}>{item.company}</Text>
      <View style={styles.scoreRow}>
        <Ionicons name="sparkles-outline" size={14} color="#5271ff" />
        <Text style={styles.matchScore}>
          {item.match_percentage ? `${item.match_percentage}% Match` : "N/A"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>AI Job Matches</Text>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5271ff" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.job_id}
          renderItem={renderJob}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#5271ff"]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No matches found.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 15 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 15 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  jobTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  company: { color: "#5271ff", marginTop: 2 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  matchScore: { color: "#555", fontSize: 13 },
  emptyText: { textAlign: "center", color: "#777", marginTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
