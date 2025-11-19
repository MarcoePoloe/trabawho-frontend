import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useChat } from "../../context/ChatContext";

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffH / 24);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH < 24) return `${diffH}h`;
  // fallback to short date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AllChatsScreen() {
  const navigation = useNavigation();   
  const { threads, fetchThreads, unreadCount, markThreadRead } = useChat();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  // local sorted threads (latest first). Keep stable with useMemo
  const sortedThreads = useMemo(() => {
    if (!Array.isArray(threads)) return [];
    // clone
    const copy = [...threads];
    copy.sort((a, b) => {
      const ta = a.last_time ? new Date(a.last_time).getTime() : 0;
      const tb = b.last_time ? new Date(b.last_time).getTime() : 0;
      return tb - ta;
    });
    if (query && query.trim() !== "") {
      const q = query.toLowerCase();
      return copy.filter(
        (t) =>
          (t.other_name && t.other_name.toLowerCase().includes(q)) ||
          (t.last_message && t.last_message.toLowerCase().includes(q))
      );
    }
    return copy;
  }, [threads, query]);

  const load = async () => {
    try {
      setLoading(true);
      await fetchThreads();
    } catch (err) {
      console.log("Failed to load threads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-fetch when screen focused (in case context didn't auto-refresh)
//   useFocusEffect(
//     useCallback(() => {
//       let mounted = true;
//       (async () => {
//         if (!mounted) return;
//         await fetchThreads();
//       })();
//       return () => {
//         mounted = false;
//       };
//     }, [fetchThreads])
//   );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchThreads();
    } catch (err) {
      console.log("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const openConversation = async (thread) => {
    // mark read locally / server-side
    try {
      await markThreadRead(thread.thread_id);
    } catch (err) {
      // ignore - still navigate
      console.log("markThreadRead err", err);
    }

    navigation.navigate("ChatConversation", {
      thread_id: thread.thread_id,
      other_user_id: thread.other_user_id,
      other_name: thread.other_name,
      other_role: thread.other_role,
      other_photo: thread.other_photo,
    });
  };

  const renderItem = ({ item }) => {
    const lastMsg = item.last_message || "No messages yet";
    const ts = item.last_time || null;
    const unread = !!item.unread;

    return (
      <TouchableOpacity
        onPress={() => openConversation(item)}
        style={[styles.row, unread ? styles.unreadRow : null]}
      >
        {/* Avatar placeholder */}
        <View style={styles.avatar}>
                <Image
                    source={
                        item.other_photo
                            ? { uri: item.other_photo }
                            : require("../../assets/untutled.png")
                    }
                    style={styles.avatarImg}
                    resizeMode="cover"
                />
            </View>


        <View style={styles.content}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread ? styles.unreadText : null]}>
              {item.other_name || "Unknown"}
            </Text>
            <Text style={styles.time}>{formatTime(ts)}</Text>
          </View>

          <View style={styles.rowBottom}>
            <Text
              numberOfLines={1}
              style={[styles.lastMessage, unread ? styles.unreadText : null]}
            >
              {lastMsg}
            </Text>

            {unread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>•</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search chats or messages..."
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={sortedThreads}
        keyExtractor={(item) => item.thread_id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation from a user's profile.
            </Text>
          </View>
        }
        contentContainerStyle={
          sortedThreads.length === 0 ? { flex: 1 } : { paddingBottom: 16 }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create
  ? StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: "#fff",
      },
      center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      },
      searchContainer: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 6,
        backgroundColor: "#fff",
      },
      searchInput: {
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        paddingHorizontal: 12,
        fontSize: 14,
        backgroundColor: "#fafafa",
      },
      row: {
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingVertical: 12,
        alignItems: "center",
      },
      unreadRow: {
        backgroundColor: "#f6fbff",
      },
      avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: "hidden",
        marginRight: 12,
        backgroundColor: "#ddd",
        justifyContent: "center",
        alignItems: "center",
      },
      avatarImg: {
        width: "100%",
        height: "100%",
      },
      content: {
        flex: 1,
        justifyContent: "center",
      },
      rowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      name: {
        fontSize: 16,
        fontWeight: "600",
        color: "#222",
        maxWidth: "78%",
      },
      time: {
        fontSize: 12,
        color: "#888",
      },
      rowBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
      },
      lastMessage: {
        fontSize: 13,
        color: "#666",
        flex: 1,
      },
      unreadText: {
        color: "#000",
        fontWeight: "700",
      },
      unreadBadge: {
        marginLeft: 8,
        backgroundColor: "#007bff",
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
      },
      unreadBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
      },
      sep: {
        height: 1,
        backgroundColor: "#f0f0f0",
        marginLeft: 72,
      },
      empty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
      },
      emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
      },
      emptySubtitle: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
      },
    })
  : {
      screen: { flex: 1 },
    };
