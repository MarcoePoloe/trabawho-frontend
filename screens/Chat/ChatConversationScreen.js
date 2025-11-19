// screens/Chat/ChatConversationScreen.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { supabase } from "../../services/supabaseClient";
import { useChatActions } from "../../context/ChatContext";
import { Ionicons } from "@expo/vector-icons";

/**
 * ChatConversationScreen — uses only actions/identity from chat context
 * (so it will not re-render when threads/unread change)
 *
 * NOTE: retains the custom header + composer layout that you asked to keep.
 */

export default function ChatConversationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const {
    thread_id,
    other_user_id,
    other_name,
    other_role,
    other_photo,
  } = route.params || {};

  // <-- USE ONLY ACTIONS/IDENTITY (no threads/unread)
  const { fetchMessages, sendMessage: sendMessageApi, markThreadRead, userId, userRole } =
    useChatActions();

  const [messages, setMessages] = useState([]); // ascending oldest -> newest
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [visibleTimestampFor, setVisibleTimestampFor] = useState(null);

  const flatRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const atBottomRef = useRef(true);
  const isInitialLoad = useRef(true);
  const isMountedRef = useRef(true);
  const isMarkedRead = useRef(false);
  const fabOpacity = useRef(new Animated.Value(0)).current;

  // debounce mark read (milliseconds)
  const lastMarkTsRef = useRef(0);
  const MARK_DEBOUNCE_MS = 1000;

  // measure composer height so FAB can position above it and list padding
  const [composerHeight, setComposerHeight] = useState(64); // initial guess

  // Keep global active thread to let ChatState skip updates for it
  useEffect(() => {
    global.ACTIVE_THREAD_ID = thread_id;
    return () => {
      global.ACTIVE_THREAD_ID = null;
    };
  }, [thread_id]);

  // ---------------------------------------------
  // Helpers
  // ---------------------------------------------
  const mergeAndDedupe = (existing = [], incoming = []) => {
    const map = new Map();
    for (const m of existing) map.set(String(m.message_id), m);
    for (const m of incoming) map.set(String(m.message_id), m);
    return Array.from(map.values());
  };

  // ---------------------------------------------
  // Message load
  // ---------------------------------------------
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const arr = await fetchMessages(thread_id);
      const normalized = Array.isArray(arr)
        ? arr.map((m) => ({ ...m, is_sent_by_me: String(m.sender_id) === String(userId) }))
        : [];
      if (!isMountedRef.current) return;
      setMessages(normalized);
      if (isInitialLoad.current) {
        setTimeout(() => scrollToBottom(true), 120);
        isInitialLoad.current = false;
      }
    } catch (err) {
      console.log("⚠️ Failed to load messages:", err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [fetchMessages, thread_id, userId]);

  useEffect(() => {
    isMountedRef.current = true;
    loadMessages();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadMessages]);

  // ---------------------------------------------
  // Scroll helpers
  // ---------------------------------------------
  const scrollToBottom = (force = false) => {
    if (!flatRef.current) return;
    try {
      flatRef.current.scrollToEnd({ animated: !force });
    } catch (e) {}
  };

  const scrollToBottomIfNear = () => {
    if (atBottomRef.current) {
      scrollToBottom(false);
    } else {
      setShowScrollBtn(true);
      Animated.timing(fabOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    }
  };

  // ---------------------------------------------
  // Incoming realtime subscribe (INSERT only)
  // ---------------------------------------------
  useEffect(() => {
    if (!thread_id) return;

    // cleanup previous
    try {
      if (realtimeChannelRef.current) {
        supabase.removeChannel?.(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    } catch (e) {}

    const ch = supabase
      .channel(`thread_messages_${thread_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${thread_id}` },
        (payload) => {
          const msg = payload?.new;
          if (!msg) return;
          const normalized = { ...msg, is_sent_by_me: String(msg.sender_id) === String(userId) };

          // Append-only (dedupe by message_id)
          setMessages((prev) => {
            if (prev.some((m) => String(m.message_id) === String(normalized.message_id))) return prev;

            const now = Date.now();
            const filtered = prev.filter((m) => {
              if (
                String(m.message_id).startsWith("local-") &&
                m.content === normalized.content &&
                Math.abs(new Date(m.created_at).getTime() - now) < 30_000
              ) {
                return false;
              }
              return true;
            });

            const next = mergeAndDedupe(filtered, [normalized]);

            if (atBottomRef.current) {
              setTimeout(() => scrollToBottom(false), 40);
            } else {
              setShowScrollBtn(true);
              Animated.timing(fabOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
            }

            return next;
          });

          // mark read debounced if message from other user
          if (String(msg.sender_id) !== String(userId)) {
            const now = Date.now();
            if (now - lastMarkTsRef.current > MARK_DEBOUNCE_MS) {
              lastMarkTsRef.current = now;
              markThreadRead(thread_id).catch((e) => console.log("markThreadRead err:", e));
            }
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = ch;

    return () => {
      try {
        if (realtimeChannelRef.current) {
          supabase.removeChannel?.(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
      } catch (e) {}
    };
  }, [thread_id, userId, markThreadRead]);

  // ---------------------------------------------
  // Scroll event handling
  // ---------------------------------------------
  const handleScroll = (e) => {
    if (!e?.nativeEvent) return;
    const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
    const paddingToBottom = 60;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - paddingToBottom;
    atBottomRef.current = isAtBottom;
    if (!isAtBottom) {
      setShowScrollBtn(true);
      Animated.timing(fabOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else {
      Animated.timing(fabOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowScrollBtn(false));
    }
  };

  // ---------------------------------------------
  // Auto-scroll when content size changes if near bottom
  // ---------------------------------------------
  const handleContentSizeChange = (w, h) => {
    if (atBottomRef.current) {
      setTimeout(() => scrollToBottom(false), 40);
    } else {
      setShowScrollBtn(true);
      Animated.timing(fabOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    }
  };

  // ---------------------------------------------
  // Send message (optimistic)
  // ---------------------------------------------
  const sendMessage = async () => {
    const content = (text || "").trim();
    if (!content || !thread_id) return;

    const localId = `local-${Date.now()}`;
    const optimistic = {
      message_id: localId,
      thread_id,
      sender_id: userId,
      sender_role: userRole || (other_role === "employer" ? "job_seeker" : "employer"),
      content,
      created_at: new Date().toISOString(),
      is_sent_by_me: true,
      localStatus: "sending",
    };

    setMessages((prev) => mergeAndDedupe(prev, [optimistic]));
    setText("");
    setSending(true);
    setTimeout(() => scrollToBottom(false), 80);

    try {
      const res = await sendMessageApi(thread_id, content);
      if (res) {
        const normalized = { ...res, is_sent_by_me: String(res.sender_id) === String(userId) };
        setMessages((prev) => {
          const filtered = prev.filter((m) => String(m.message_id) !== String(localId) && String(m.message_id) !== String(normalized.message_id));
          return mergeAndDedupe(filtered, [normalized]);
        });
        setTimeout(() => scrollToBottom(false), 60);
      } else {
        // rely on realtime to append; keep optimistic until then
      }
    } catch (err) {
      console.log("send err", err);
      setMessages((prev) => prev.map((m) => (String(m.message_id) === String(localId) ? { ...m, localStatus: "failed" } : m)));
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------
  // Render message bubble (kept same as you requested)
  // ---------------------------------------------
  const renderMessage = ({ item }) => {
    const isMe = !!item.is_sent_by_me;
    const bubbleStyle = isMe ? styles.bubbleRight : styles.bubbleLeft;
    const textStyle = isMe ? styles.textRight : styles.textLeft;
    const showTimestamp = visibleTimestampFor === item.message_id;

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => setVisibleTimestampFor((p) => (p === item.message_id ? null : item.message_id))}
        style={[styles.messageRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
        {!isMe && (
          <View style={styles.smallAvatarWrapper}>
            {other_photo ? <Image source={{ uri: other_photo }} style={styles.smallAvatar} /> : null}
          </View>
        )}

        <View style={bubbleStyle}>
          <Text style={textStyle}>{item.content}</Text>

          <View style={styles.metaRow}>
            {item.localStatus === "sending" && <Text style={styles.metaText}>Sending…</Text>}
            {item.localStatus === "failed" && (
              <TouchableOpacity onPress={() => { /* optionally implement retry */ }}>
                <Text style={[styles.metaText, { color: "#c00" }]}>Failed • Tap to retry</Text>
              </TouchableOpacity>
            )}
            {showTimestamp && <Text style={[styles.timestamp]}>{new Date(item.created_at).toLocaleString()}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const keyExtractor = (item) => String(item.message_id);

  // header: keep custom header (you asked to retain it)
  useEffect(() => {
    navigation.setOptions({
      title: other_name || "Chat",
      headerBackTitle: "Back",
    });
  }, [navigation, other_name]);

  // compute composer + fab positions using safe area insets
  const fabBottom = composerHeight + (insets.bottom || 0) + 12;
  const listPaddingBottom = composerHeight + (insets.bottom || 0) + 20;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      {/* Custom header (kept) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerUserBlock} onPress={() => other_user_id && navigation.navigate("ProfileDetail", { user_id: other_user_id })}>
          {other_photo ? <Image source={{ uri: other_photo }} style={styles.headerAvatar} /> : null}
          <Text style={styles.headerName} numberOfLines={1}>{other_name}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 + (insets.top || 0) : 80}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" /></View>
          ) : (
            <>
              <FlatList
                ref={flatRef}
                data={messages}
                keyExtractor={keyExtractor}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 12, paddingBottom: listPaddingBottom }}
                onScroll={handleScroll}
                onContentSizeChange={handleContentSizeChange}
                scrollEventThrottle={100}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No messages yet — say hi 👋</Text></View>}
              />

              {showScrollBtn && (
                <Animated.View style={[styles.scrollButton, { opacity: fabOpacity, bottom: fabBottom }]}>
                  <TouchableOpacity onPress={() => { scrollToBottom(false); setShowScrollBtn(false); }} style={styles.scrollButtonTouchable}>
                    <Ionicons name="chevron-down" size={22} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom || 12, 12) }]} onLayout={(e) => { const h = e?.nativeEvent?.layout?.height; if (h && h > 0) setComposerHeight(h); }}>
                <TextInput placeholder="Type a message..." placeholderTextColor="#888" style={styles.input} value={text} onChangeText={setText} multiline={false} editable={!sending} returnKeyType="send" onSubmitEditing={() => sendMessage()} />
                <TouchableOpacity style={[styles.sendBtn, sending ? { opacity: 0.6 } : null]} onPress={() => sendMessage()} disabled={sending}>
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------- Styles (kept the same as your current file) ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: "#666" },

  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerName: { fontSize: 18, fontWeight: "600", color: "#222", maxWidth: 220 },

  messageRow: { marginVertical: 6, flexDirection: "row", alignItems: "flex-end", maxWidth: "100%" },
  bubbleLeft: { backgroundColor: "#f1f3f6", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, maxWidth: "78%", alignSelf: "flex-start" },
  bubbleRight: { backgroundColor: "#0a84ff", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, maxWidth: "78%", alignSelf: "flex-end", marginRight: 6 },
  textLeft: { color: "#111", fontSize: 15 },
  textRight: { color: "#fff", fontSize: 15 },

  metaRow: { marginTop: 6, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  metaText: { fontSize: 11, color: "#888", marginRight: 6 },
  timestamp: { fontSize: 11, color: "#999", marginLeft: 6 },

  smallAvatarWrapper: { marginRight: 8 },
  smallAvatar: { width: 28, height: 28, borderRadius: 14 },

  composer: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, borderColor: "#eee", backgroundColor: "#fff", alignItems: "center" },
  input: { flex: 1, minHeight: 40, maxHeight: 120, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "#e6e6e6", backgroundColor: "#fbfbfb", marginRight: 8, fontSize: 15 },
  sendBtn: { backgroundColor: "#0a84ff", width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },

  scrollButton: { position: "absolute", right: 16, zIndex: 10 },
  scrollButtonTouchable: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0a84ff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },

  backButton: { padding: 6, paddingRight: 12, justifyContent: "center", alignItems: "center" },
  headerUserBlock: { flexDirection: "row", alignItems: "center" },
});
