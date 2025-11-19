// /context/ChatContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRequest, postRequest } from "../services/api";
import { supabase } from "../services/supabaseClient";

/**
 * Split Chat Context into:
 *  - ChatStateContext (threads, unreadCount, fetchThreads)
 *  - ChatActionsContext (userId, userRole, fetchMessages, sendMessage, markThreadRead, startThread)
 *
 * Conversation screens should use useChatActions() to avoid re-rendering when threads change.
 * Lists (AllChatsScreen) should use useChatState().
 */

// ---------- Contexts ----------
const ChatStateContext = createContext(null);
const ChatActionsContext = createContext(null);

// ---------- Provider ----------
export const ChatProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [threads, setThreads] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const supabaseRef = useRef(null);
  const threadsLoadedOnce = useRef(false);
  const realtimeThreadsChannelRef = useRef(null);

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  const computeUnreadFromRealtimeRow = (row, role) => {
    if (!row) return false;
    if (role === "employer") return row.read_by_employer === false;
    return row.read_by_jobseeker === false;
  };

  const upsertThreadFromRealtimeRow = useCallback(
    (row) => {
      if (!row || !row.thread_id) return;

      setThreads((prev) => {
        const id = String(row.thread_id);
        const idx = prev.findIndex((t) => String(t.thread_id) === id);

        const unreadForCurrentUser = computeUnreadFromRealtimeRow(row, userRole);

        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            read_by_employer: row.read_by_employer,
            read_by_jobseeker: row.read_by_jobseeker,
            unread: unreadForCurrentUser,
            last_time: row.created_at ?? next[idx].last_time,
          };
          // move to top if unread
          if (next[idx].unread) {
            const [it] = next.splice(idx, 1);
            next.unshift(it);
          }
          return next;
        } else {
          const placeholder = {
            thread_id: id,
            employer_id: row.employer_id,
            job_seeker_id: row.job_seeker_id,
            other_user_id: row.employer_id === userId ? row.job_seeker_id : row.employer_id,
            other_role: row.employer_id === userId ? "job_seeker" : "employer",
            other_name: "Unknown",
            other_photo: null,
            last_message: null,
            last_time: row.created_at ?? new Date().toISOString(),
            read_by_employer: row.read_by_employer,
            read_by_jobseeker: row.read_by_jobseeker,
            unread: unreadForCurrentUser,
          };
          return [placeholder, ...prev];
        }
      });
    },
    [userId, userRole]
  );

  const upsertThreadFromMessage = useCallback(
    (msg) => {
      if (!msg || !msg.thread_id) return;
      setThreads((prev) => {
        const id = String(msg.thread_id);
        const idx = prev.findIndex((t) => String(t.thread_id) === id);

        const unreadForCurrentUser =
          userRole === "employer" ? msg.sender_role === "job_seeker" : msg.sender_role === "employer";

        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            last_message: msg.content,
            last_sender_role: msg.sender_role,
            last_time: msg.created_at,
            unread: unreadForCurrentUser ? true : copy[idx].unread,
          };
          // move to top
          const [it] = copy.splice(idx, 1);
          copy.unshift(it);
          return copy;
        } else {
          const placeholder = {
            thread_id: id,
            other_user_id: msg.sender_id === userId ? null : msg.sender_id,
            other_role: msg.sender_role,
            other_name: "Unknown",
            other_photo: null,
            last_message: msg.content,
            last_time: msg.created_at,
            unread: unreadForCurrentUser,
          };
          return [placeholder, ...prev];
        }
      });
    },
    [userId, userRole]
  );

  // ------------------------------------------------------------------
  // loadUser
  // ------------------------------------------------------------------
  const loadUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await getRequest("/me");
      const user = res?.data;
      if (user?.id) {
        setUserId(user.id);
        setUserRole(user.role);
        await AsyncStorage.setItem("user_id", user.id);
      }
    } catch (err) {
      console.log("⚠️ Failed to load /me:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // fetchThreads (state)
  // ------------------------------------------------------------------
  const fetchThreads = useCallback(async () => {
    try {
      const res = await getRequest("/chat/my-threads");
      const data = res?.data;
      if (Array.isArray(data)) {
        setThreads(data);
        threadsLoadedOnce.current = true;
      }
    } catch (err) {
      console.log("⚠️ Failed to fetch threads:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // fetchMessages helper (action)
  // ------------------------------------------------------------------
  const fetchMessages = useCallback(
    async (threadId) => {
      try {
        const res = await getRequest(`/chat/thread/${threadId}/messages`);
        return res?.data || [];
      } catch (err) {
        console.log("⚠️ Failed to load messages:", err);
        return [];
      }
    },
    []
  );

  // ------------------------------------------------------------------
  // startThread (action)
  // ------------------------------------------------------------------
  const startThread = useCallback(async ({ recipient_id, recipient_role }) => {
    try {
      const res = await postRequest("/chat/start", { recipient_id, recipient_role });
      const thread = res?.data;
      if (thread?.thread_id) {
        setThreads((prev) => {
          const exists = prev.some((t) => String(t.thread_id) === String(thread.thread_id));
          if (exists) return prev;
          return [thread, ...prev];
        });
      }
      return thread;
    } catch (err) {
      console.log("⚠️ Failed to start thread:", err);
      return null;
    }
  }, []);

  // ------------------------------------------------------------------
  // sendMessage (action)
  // - uses fallback to fetchThreads only when not in active thread
  // ------------------------------------------------------------------
  const sendMessage = useCallback(
    async (threadId, content) => {
      try {
        const res = await postRequest(`/chat/thread/${threadId}/send-message`, {
          content,
          sender_role: userRole,
        });

        // fallback: update threads only if not in active conversation
        setTimeout(() => {
          if (!global.ACTIVE_THREAD_ID || String(global.ACTIVE_THREAD_ID) !== String(threadId)) {
            fetchThreads().catch(() => {});
          }
        }, 700);

        return res?.data;
      } catch (err) {
        console.log("⚠️ Failed to send message:", err);
        return null;
      }
    },
    [fetchThreads, userRole]
  );

  // ------------------------------------------------------------------
  // markThreadRead (action)
  // - optimistic update of state threads (so state consumers reflect it),
  //   but actions consumers (conversation screen) won't re-render because they don't subscribe to state context.
  // ------------------------------------------------------------------
  const markThreadRead = useCallback(
    async (threadId) => {
      try {
        // optimistic update - set unread false for that thread (state context)
        setThreads((prev) => {
          const idx = prev.findIndex((t) => String(t.thread_id) === String(threadId));
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], unread: false };
          return copy;
        });

        // async backend call
        await postRequest(`/chat/thread/${threadId}/read`, {});
      } catch (err) {
        console.log("⚠️ Failed to mark thread read:", err);
      }
    },
    []
  );

  // ------------------------------------------------------------------
  // Realtime for threads ONLY (state context)
  // ------------------------------------------------------------------
  const connectRealtime = useCallback(() => {
    if (!supabaseRef.current) return;

    try {
      if (realtimeThreadsChannelRef.current) {
        supabaseRef.current.removeChannel?.(realtimeThreadsChannelRef.current);
        realtimeThreadsChannelRef.current = null;
      }
    } catch (e) {}

    const threadsChannel = supabaseRef.current
      .channel("chat_threads_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_threads" },
        (payload) => {
          const row = payload?.new;
          if (!row) return;

          // If this update belongs to the currently-open thread, skip mutating threads.
          if (global.ACTIVE_THREAD_ID && String(global.ACTIVE_THREAD_ID) === String(row.thread_id)) {
            return;
          }

          upsertThreadFromRealtimeRow(row);
        }
      );

    threadsChannel.subscribe();
    realtimeThreadsChannelRef.current = threadsChannel;
  }, [upsertThreadFromRealtimeRow]);

  // ------------------------------------------------------------------
  // recompute unread when threads change
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!Array.isArray(threads)) return;
    const count = threads.reduce((acc, t) => acc + (t?.unread ? 1 : 0), 0);
    setUnreadCount(count);
  }, [threads]);

  // init supabase ref
  useEffect(() => {
    supabaseRef.current = supabase;
  }, []);

  // load user on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // after user loads
  useEffect(() => {
    if (!userId) return;
    fetchThreads();
    connectRealtime();

    return () => {
      try {
        supabaseRef.current?.removeChannel?.(realtimeThreadsChannelRef.current);
      } catch {}
    };
  }, [userId, userRole, fetchThreads, connectRealtime]);

  // ------------------------------------------------------------------
  // Memoized values for providers
  // ------------------------------------------------------------------
  const stateValue = useMemo(
    () => ({
      threads,
      unreadCount,
      fetchThreads,
      upsertThreadFromMessage, // exposed so other parts can update thread list on message insert if desired
    }),
    [threads, unreadCount, fetchThreads, upsertThreadFromMessage]
  );

  const actionsValue = useMemo(
    () => ({
      userId,
      userRole,
      fetchMessages,
      sendMessage,
      markThreadRead,
      startThread,
    }),
    [userId, userRole, fetchMessages, sendMessage, markThreadRead, startThread]
  );

  return (
    <ChatActionsContext.Provider value={actionsValue}>
      <ChatStateContext.Provider value={stateValue}>{children}</ChatStateContext.Provider>
    </ChatActionsContext.Provider>
  );
};

// ---------- Hooks ----------

// For screens that need only the actions and identity (ChatConversationScreen)
export const useChatActions = () => {
  const ctx = useContext(ChatActionsContext);
  if (!ctx) throw new Error("useChatActions must be used within ChatProvider");
  return ctx;
};

// For screens that need only threads/state (AllChatsScreen)
export const useChatState = () => {
  const ctx = useContext(ChatStateContext);
  if (!ctx) throw new Error("useChatState must be used within ChatProvider");
  return ctx;
};

// Legacy: useChat returns both (backwards compatibility). Consumers should migrate to useChatActions/useChatState.
export const useChat = () => {
  const actions = useContext(ChatActionsContext);
  const state = useContext(ChatStateContext);
  if (!actions || !state) throw new Error("useChat must be used within ChatProvider");
  return { ...actions, ...state };
};
