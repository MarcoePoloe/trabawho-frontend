// /context/ChatContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRequest, postRequest } from "../services/api";
import { supabase } from "../services/supabaseClient";

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [threads, setThreads] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const supabaseRef = useRef(null);
  const threadsLoadedOnce = useRef(false);
  const realtimeChannelRef = useRef(null);

  // --------------------------------------------
  // Utility: shallow compare thread arrays
  // --------------------------------------------
  const threadsAreSame = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (
        a[i].thread_id !== b[i].thread_id ||
        a[i].last_message !== b[i].last_message ||
        a[i].last_time !== b[i].last_time ||
        a[i].unread !== b[i].unread
      ) {
        return false;
      }
    }
    return true;
  };

  // --------------------------------------------
  // /me — load user info
  // --------------------------------------------
  const loadUser = async () => {
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
  };

  // --------------------------------------------
  // Fetch threads WITH dedupe check
  // --------------------------------------------
  const fetchThreads = async () => {
    try {
      const res = await getRequest("/chat/my-threads");
      const data = res?.data;

      if (Array.isArray(data)) {
        if (!threadsAreSame(threads, data)) {
          setThreads(data);
          const unread = data.filter((t) => t.unread === true).length;
          setUnreadCount(unread);
        }
        threadsLoadedOnce.current = true;
      }
    } catch (err) {
      console.log("⚠️ Failed to fetch threads:", err);
    }
  };

  // --------------------------------------------
  // Realtime listener
  // --------------------------------------------
  const connectRealtime = () => {
    if (!supabaseRef.current) return;

    if (realtimeChannelRef.current) {
      supabaseRef.current.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabaseRef.current
      .channel("chat_threads_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_threads",
        },
        async (payload) => {
          console.log("🔔 Realtime Update:", payload);

          if (threadsLoadedOnce.current) {
            // DEFER REFRESH to avoid React Navigation error
            setTimeout(() => {
              fetchThreads();
            }, 0);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  };

  // --------------------------------------------
  // Fetch messages for a thread
  // --------------------------------------------
  const fetchMessages = async (threadId) => {
    try {
      const res = await getRequest(`/chat/thread/${threadId}/messages`);
      return res?.data || [];
    } catch (err) {
      console.log("⚠️ Failed to load messages:", err);
      return [];
    }
  };

  // --------------------------------------------
  // Send message — FIXED (no more useInsertionEffect warning)
  // --------------------------------------------
  const sendMessage = async (threadId, content) => {
    try {
      const payload = {
        content,
        sender_role: userRole, // 🔥 Make sure correct role is passed
      };

      const res = await postRequest(
        `/chat/thread/${threadId}/send-message`,
        payload
      );

      // DEFER thread refresh → fixes useInsertionEffect crash
      setTimeout(() => {
        fetchThreads();
      }, 0);

      return res?.data;
    } catch (err) {
      console.log("⚠️ Failed to send message:", err);
      return null;
    }
  };

  // --------------------------------------------
  // Mark thread read
  // --------------------------------------------
  const markThreadRead = async (threadId) => {
    try {
      await postRequest(`/chat/thread/${threadId}/read`, {});
    } catch (err) {
      console.log("⚠️ Failed to mark thread read:", err);
    }
  };

  // --------------------------------------------
  // Init Supabase
  // --------------------------------------------
  useEffect(() => {
    supabaseRef.current = supabase;
  }, []);

  // --------------------------------------------
  // Load user on mount
  // --------------------------------------------
  useEffect(() => {
    loadUser();
  }, []);

  // --------------------------------------------
  // After user loads → fetch threads + start realtime
  // --------------------------------------------
  useEffect(() => {
    if (!userId) return;

    fetchThreads();
    connectRealtime();

    return () => {
      if (supabaseRef.current) {
        supabaseRef.current.removeAllChannels();
      }
    };
  }, [userId]);

  return (
    <ChatContext.Provider
      value={{
        userId,
        userRole,
        threads,
        unreadCount,
        fetchThreads,
        fetchMessages,
        sendMessage,
        markThreadRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
