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
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { supabase } from "../../services/supabaseClient";
import { useChat } from "../../context/ChatContext";
import { Ionicons } from "@expo/vector-icons";

/**
 * ChatConversationScreen
 * - safe-area aware header
 * - composer sits above nav keys and keyboard
 * - scroll-to-bottom FAB floats above composer
 * - deduplication logic to avoid double messages (optimistic + realtime)
 * - smooth realtime append (no full reload)
 *
 * Important: outgoing messages use sender_role = userRole (from useChat)
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
    other_photo, // optional
  } = route.params || {};

  // NOTE: we now destructure userRole from useChat and alias sendMessage to sendMessageApi
  const {
    fetchMessages,
    sendMessage: sendMessageApi,
    markThreadRead,
    userId,
    userRole,
  } = useChat();

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

  // measure composer height so FAB can position above it and list padding
  const [composerHeight, setComposerHeight] = useState(64); // initial guess

  // Helper: merge + dedupe messages by message_id, keep server message over local optimistic
  const mergeAndDedupe = (existing = [], incoming = []) => {
    const map = new Map();
    // insert existing
    for (const m of existing) {
      map.set(String(m.message_id), m);
    }
    // insert incoming, overwriting entries with same message_id
    for (const m of incoming) {
      map.set(String(m.message_id), m);
    }
    // produce sorted ascending array by created_at
    const out = Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    return out;
  };

  // --- Load messages (once)
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMessages(thread_id);
      const sorted = Array.isArray(data)
        ? data.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        : [];
      if (!isMountedRef.current) return;
      // normalize incoming messages: ensure is_sent_by_me present
      const normalized = sorted.map((m) => ({
        ...m,
        is_sent_by_me: String(m.sender_id) === String(userId),
      }));
      setMessages(normalized);
      if (isInitialLoad.current) {
        // wait a tick then scroll
        setTimeout(() => scrollToBottom(true), 120);
        isInitialLoad.current = false;
      }
    } catch (err) {
      console.log("⚠️ Failed to load messages:", err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [fetchMessages, thread_id, userId]);

  // mark thread read once
  useEffect(() => {
    if (!thread_id) return;
    if (isMarkedRead.current) return;
    (async () => {
      try {
        await markThreadRead(thread_id);
        isMarkedRead.current = true;
      } catch (err) {
        console.log("⚠️ markThreadRead err:", err);
      }
    })();
  }, [markThreadRead, thread_id]);

  // realtime subscribe for INSERT only (append)
  useEffect(() => {
    if (!thread_id) return;

    // cleanup previous if any
    if (realtimeChannelRef.current) {
      try {
        supabase.removeChannel(realtimeChannelRef.current);
      } catch (e) {}
      realtimeChannelRef.current = null;
    }

    const channelName = `chat_messages_${thread_id}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${thread_id}`,
        },
        (payload) => {
          const newMsg = payload?.new;
          if (!newMsg) return;

          // normalize is_sent_by_me (compare sender_id to local userId)
          const normalized = {
            ...newMsg,
            is_sent_by_me: String(newMsg.sender_id) === String(userId),
          };

          // append only if message_id not already present
          setMessages((prev) => {
            // if we already have this message_id, skip
            if (prev.some((m) => String(m.message_id) === String(normalized.message_id))) {
              return prev;
            }

            // Also: remove optimistic local messages that match content and are recent,
            // to avoid showing optimistic + server duplicates.
            const now = Date.now();
            const filtered = prev.filter((m) => {
              // Remove optimistic if:
              // - message_id starts with "local-"
              // - content matches
              // - optimistic created within last 30 seconds (to be safe)
              if (
                String(m.message_id).startsWith("local-") &&
                m.content === normalized.content
              ) {
                // remove the optimistic entry
                return false;
              }
              return true;
            });

            const next = mergeAndDedupe(filtered, [normalized]);

            // auto-scroll if user near bottom
            if (atBottomRef.current && flatRef.current) {
              setTimeout(() => scrollToBottom(false), 50);
            } else {
              // show scroll button
              setShowScrollBtn(true);
              Animated.timing(fabOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }).start();
            }

            return next;
          });
        }
      )
      .subscribe((status, err) => {
        if (err) console.log("realtime subscribe err:", err);
      });

    realtimeChannelRef.current = ch;

    return () => {
      if (realtimeChannelRef.current) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch (e) {}
        realtimeChannelRef.current = null;
      }
    };
  }, [thread_id, userId]);

  // initial load + cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadMessages();
    return () => {
      isMountedRef.current = false;
      if (realtimeChannelRef.current) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch (e) {}
        realtimeChannelRef.current = null;
      }
    };
  }, [loadMessages]);

  // scroll helpers
  const scrollToBottom = (force = false) => {
    if (!flatRef.current) return;
    try {
      if (flatRef.current.scrollToEnd) {
        flatRef.current.scrollToEnd({ animated: !force });
      } else {
        flatRef.current.scrollToOffset({ offset: 99999, animated: !force });
      }
    } catch (e) {
      // ignore
    }
  };

  // send message with optimistic UI
  const sendMessage = async () => {
    const content = (text || "").trim();
    if (!content || !thread_id) return;

    const localId = `local-${Date.now()}`;
    const optimistic = {
      message_id: localId,
      thread_id,
      sender_id: userId,
      // use userRole for outgoing messages as requested
      sender_role: userRole || (other_role === "employer" ? "job_seeker" : "employer"),
      content,
      created_at: new Date().toISOString(),
      is_sent_by_me: true,
      localStatus: "sending",
      retries: 0,
    };

    // append optimistic
    setMessages((prev) => mergeAndDedupe(prev, [optimistic]));

    setText("");
    setSending(true);
    // scroll to show optimistic quickly
    setTimeout(() => scrollToBottom(false), 80);

    try {
      const res = await sendMessageApi(thread_id, content);
      if (res) {
        // ensure normalized flags
        const normalized = {
          ...res,
          is_sent_by_me: String(res.sender_id) === String(userId),
        };

        setMessages((prev) => {
          // remove optimistic local message(s) with same localId and also ensure we don't have duplicates
          const filtered = prev.filter(
            (m) =>
              String(m.message_id) !== String(localId) &&
              String(m.message_id) !== String(normalized.message_id)
          );

          const next = mergeAndDedupe(filtered, [normalized]);
          return next;
        });

        // keep view at bottom
        setTimeout(() => scrollToBottom(false), 60);
      } else {
        markLocalFailed(localId);
      }
    } catch (err) {
      console.log("sendMessage err", err);
      markLocalFailed(localId);
    } finally {
      setSending(false);
    }
  };

  const markLocalFailed = (localId) => {
    setMessages((prev) =>
      prev.map((m) =>
        String(m.message_id) === String(localId)
          ? { ...m, localStatus: "failed", retries: (m.retries || 0) }
          : m
      )
    );
  };

  const retryMessage = async (msg) => {
    if (!msg || msg.localStatus !== "failed") return;
    const currentRetries = msg.retries || 0;
    if (currentRetries >= 3) return;

    setMessages((prev) =>
      prev.map((m) =>
        String(m.message_id) === String(msg.message_id)
          ? { ...m, localStatus: "sending", retries: currentRetries + 1 }
          : m
      )
    );

    try {
      const res = await sendMessageApi(thread_id, msg.content);
      if (res) {
        const normalized = { ...res, is_sent_by_me: String(res.sender_id) === String(userId) };
        setMessages((prev) => {
          const filtered = prev.filter(
            (m) =>
              String(m.message_id) !== String(msg.message_id) &&
              String(m.message_id) !== String(normalized.message_id)
          );
          return mergeAndDedupe(filtered, [normalized]);
        });
        scrollToBottom(false);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            String(m.message_id) === String(msg.message_id) ? { ...m, localStatus: "failed" } : m
          )
        );
      }
    } catch (err) {
      console.log("retry err", err);
      setMessages((prev) =>
        prev.map((m) =>
          String(m.message_id) === String(msg.message_id) ? { ...m, localStatus: "failed" } : m
        )
      );
    }
  };

  // render message bubble
  const renderMessage = ({ item }) => {
    const isMe = !!item.is_sent_by_me;
    const bubbleStyle = isMe ? styles.bubbleRight : styles.bubbleLeft;
    const textStyle = isMe ? styles.textRight : styles.textLeft;
    const showTimestamp = visibleTimestampFor === item.message_id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          setVisibleTimestampFor((prev) => (prev === item.message_id ? null : item.message_id))
        }
        style={[
          styles.messageRow,
          isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" },
        ]}
      >
        {/* other user's small avatar */}
        {!isMe && (
          <View style={styles.smallAvatarWrapper}>
            {other_photo ? (
              <Image source={{ uri: other_photo }} style={styles.smallAvatar} />
            ) : (
              <Image source={require("../../assets/untutled.png")} style={styles.smallAvatar} />
            )}
          </View>
        )}

        <View style={[bubbleStyle]}>
          <Text style={[textStyle]}>{item.content}</Text>

          <View style={styles.metaRow}>
            {item.localStatus === "sending" && <Text style={styles.metaText}>Sending…</Text>}
            {item.localStatus === "failed" && (
              <TouchableOpacity onPress={() => retryMessage(item)}>
                <Text style={[styles.metaText, { color: "#c00" }]}>Failed • Tap to retry</Text>
              </TouchableOpacity>
            )}
            {showTimestamp && (
              <Text style={[styles.timestamp]}>{new Date(item.created_at).toLocaleString()}</Text>
            )}
          </View>
        </View>

        {/* removed right spacer for current user's messages (so bubble aligns to edge) */}
      </TouchableOpacity>
    );
  };

  // onScroll handler: determine if at bottom
  const handleScroll = (e) => {
    if (!e?.nativeEvent) return;
    const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
    const paddingToBottom = 40;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - paddingToBottom;
    atBottomRef.current = isAtBottom;

    if (!isAtBottom) {
      setShowScrollBtn(true);
      Animated.timing(fabOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fabOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowScrollBtn(false));
    }
  };

  // key extractor - ensure uniqueness (include created_at as fallback)
  const keyExtractor = (item) =>
    `${String(item.message_id)}_${String(item.created_at || "")}`;

  // header: use native header title as fallback (we also render custom header)
  useEffect(() => {
    navigation.setOptions({
      title: other_name || "Chat",
      headerBackTitle: "Back",
    });
  }, [navigation, other_name]);

  // FAB bottom and list bottom padding calculated by measured composer height + safe area
  const fabBottom = composerHeight + (insets.bottom || 0) + 12;
  const listPaddingBottom = composerHeight + (insets.bottom || 0) + 20;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      {/* Custom header (safe) */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>

        {/* Avatar + Name (Touchable → Profile Detail) */}
        <TouchableOpacity
          style={styles.headerUserBlock}
          onPress={() => {
            if (other_user_id) {
              navigation.navigate("ProfileDetail", { user_id: other_user_id });
            }
          }}
        >
          <Image
            source={other_photo ? { uri: other_photo } : require("../../assets/untutled.png")}
            style={styles.headerAvatar}
          />
          <Text style={styles.headerName} numberOfLines={1}>
            {other_name}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#fff" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 + (insets.top || 0) : 80}
      >
        <View style={styles.container}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <>
              <FlatList
                ref={flatRef}
                data={messages}
                keyExtractor={keyExtractor}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 12, paddingBottom: listPaddingBottom }}
                onScroll={handleScroll}
                scrollEventThrottle={100}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No messages yet. Say hi 👋</Text>
                  </View>
                }
              />

              {/* Scroll-to-bottom FAB positioned above composer */}
              {showScrollBtn && (
                <Animated.View
                  style={[styles.scrollButton, { opacity: fabOpacity, bottom: fabBottom }]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      scrollToBottom(false);
                      setShowScrollBtn(false);
                    }}
                    style={styles.scrollButtonTouchable}
                  >
                    <Ionicons name="chevron-down" size={22} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Composer: measure height onLayout and respect safe area bottom */}
              <View
                style={[styles.composer, { paddingBottom: Math.max(insets.bottom || 12, 12) }]}
                onLayout={(e) => {
                  const h = e?.nativeEvent?.layout?.height;
                  if (h && h > 0) setComposerHeight(h);
                }}
              >
                <TextInput
                  placeholder="Type a message..."
                  placeholderTextColor="#888"
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  multiline={false}
                  editable={!sending}
                  returnKeyType="send"
                  onSubmitEditing={() => sendMessage()}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, sending ? { opacity: 0.6 } : null]}
                  onPress={() => sendMessage()}
                  disabled={sending}
                >
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    maxWidth: 220,
  },

  messageRow: {
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "100%",
  },

  bubbleLeft: {
    backgroundColor: "#f1f3f6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    maxWidth: "78%",
    alignSelf: "flex-start",
  },
  bubbleRight: {
    backgroundColor: "#0a84ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    maxWidth: "78%",
    alignSelf: "flex-end",
    marginRight: 6, // tiny gap from right edge
  },
  textLeft: { color: "#111", fontSize: 15 },
  textRight: { color: "#fff", fontSize: 15 },

  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  metaText: { fontSize: 11, color: "#888", marginRight: 6 },

  timestamp: { fontSize: 11, color: "#999", marginLeft: 6 },

  smallAvatarWrapper: { marginRight: 8 },
  smallAvatar: { width: 28, height: 28, borderRadius: 14 },

  composer: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#fbfbfb",
    marginRight: 8,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: "#0a84ff",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollButton: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  scrollButtonTouchable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0a84ff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  backButton: {
    padding: 6,
    paddingRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  headerUserBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
});
