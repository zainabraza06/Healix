"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minimize2, Maximize2, Send, MessageSquare, User, Circle, Check, CheckCheck } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { connectSocket, joinRooms, onChatReceive, offChatReceive, emitChatMessage, emitTyping, onTyping, offTyping, checkUserStatus, onStatusResponse, offStatusResponse } from "@/lib/socket";
import { useAuthStore } from "@/lib/authStore";
import toast from "react-hot-toast";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FloatingChatButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:shadow-emerald-500/50 transition-shadow duration-300"
      title="Open Chat"
    >
      <MessageSquare className="w-6 h-6" />
    </motion.button>
  );
}

export default function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const { user } = useAuthStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const isDoctor = user?.role === 'DOCTOR';
  const isPatient = user?.role === 'PATIENT';

  useEffect(() => {
    if (isOpen && !selectedContact && contacts.length === 0) {
      fetchContacts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (!user || !selectedContact) return;

    const contactUserId = selectedContact.user_id;
    if (!contactUserId) return;

    const socket = connectSocket(localStorage.getItem("token") || undefined);
    socketRef.current = socket;
    
    joinRooms({
      userId: user.id,
      role: user.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
      doctorId: isDoctor ? user.id : contactUserId,
      patientId: isPatient ? user.id : contactUserId
    });

    const handler = (payload: any) => {
      if (payload?.senderId === contactUserId) {
        const newMsg = payload.message;
        setMessages((prev) => [...prev, newMsg]);
        markAsDelivered([newMsg.id || newMsg._id]);
        scrollToBottom();
      }
    };

    const typingHandler = (payload: any) => {
      if (payload?.senderId === contactUserId) {
        setIsTyping(payload.isTyping);
        if (payload.isTyping) {
          setTimeout(() => setIsTyping(false), 3000);
        }
      }
    };

    const statusHandler = (payload: any) => {
      console.log('Received chat:status event:', payload);
      console.log('Current messages:', messages.map(m => ({ id: m.id, _id: m._id, status: m.status })));
      
      setMessages((prev) =>
        prev.map((msg) => {
          const msgId = msg.id || msg._id;
          if (msgId === payload.messageId) {
            console.log(`✓ Updating message ${payload.messageId} status from ${msg.status} to ${payload.status.toUpperCase()}`);
            return { ...msg, status: payload.status.toUpperCase() };
          }
          return msg;
        })
      );
    };

    const onlineHandler = (payload: any) => {
      if (payload?.userId === contactUserId) {
        console.log(`Contact ${contactUserId} is now online`);
        setIsOnline(true);
      }
    };

    const offlineHandler = (payload: any) => {
      if (payload?.userId === contactUserId) {
        console.log(`Contact ${contactUserId} went offline`);
        setIsOnline(false);
      }
    };

    const statusResponseHandler = (payload: { userId: string; isOnline: boolean }) => {
      if (payload?.userId === contactUserId) {
        console.log(`Contact ${contactUserId} status check: ${payload.isOnline ? 'online' : 'offline'}`);
        setIsOnline(payload.isOnline);
      }
    };

    // Handle socket reconnection
    const reconnectHandler = () => {
      console.log('Socket reconnected, rejoining rooms and checking status...');
      joinRooms({
        userId: user.id,
        role: user.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
        doctorId: isDoctor ? user.id : contactUserId,
        patientId: isPatient ? user.id : contactUserId
      });
      // Re-check contact status after reconnection
      checkUserStatus(contactUserId);
    };

    onChatReceive(handler);
    onTyping(typingHandler);
    onStatusResponse(statusResponseHandler);
    socket?.on("chat:status", statusHandler);
    socket?.on("doctor:online", onlineHandler);
    socket?.on("patient:online", onlineHandler);
    socket?.on("user:offline", offlineHandler);
    socket?.on("connect", reconnectHandler);

    // Check contact's current status immediately
    checkUserStatus(contactUserId);

    // Periodic status check every 30 seconds as a backup
    const statusCheckInterval = setInterval(() => {
      if (contactUserId) {
        checkUserStatus(contactUserId);
      }
    }, 30000);

    return () => {
      offChatReceive(handler);
      offTyping(typingHandler);
      offStatusResponse(statusResponseHandler);
      socket?.off("chat:status", statusHandler);
      socket?.off("doctor:online", onlineHandler);
      socket?.off("patient:online", onlineHandler);
      socket?.off("user:offline", offlineHandler);
      socket?.off("connect", reconnectHandler);
      clearInterval(statusCheckInterval);
    };
  }, [user, selectedContact]);

  useEffect(() => {
    scrollToBottom();
    if (selectedContact && messages.length > 0 && !isMinimized) {
      const myRole = isDoctor ? "DOCTOR" : "PATIENT";
      const unreadMessages = messages
        .filter(m => m.sender_role !== myRole && m.status !== "READ")
        .map(m => m.id || m._id);

      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages);
      }
    }
  }, [messages, isMinimized, selectedContact]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const markAsDelivered = async (messageIds: string[]) => {
    try {
      await apiClient.post("/chat/messages/delivered", { messageIds });
      
      // Update local state immediately
      setMessages((prev) =>
        prev.map((msg) =>
          messageIds.includes(msg.id || msg._id)
            ? { ...msg, status: "DELIVERED" }
            : msg
        )
      );
      
      // Notify sender via socket
      messageIds.forEach(messageId => {
        if (socketRef.current && selectedContact) {
          socketRef.current.emit('chat:status', {
            messageId,
            status: 'delivered',
            recipientId: selectedContact.user_id
          });
        }
      });
    } catch (error) {
      console.error("Failed to mark as delivered", error);
    }
  };

  const markAsRead = async (messageIds: string[]) => {
    try {
      await apiClient.post("/chat/messages/read", { messageIds });
      setMessages((prev) =>
        prev.map((msg) =>
          messageIds.includes(msg.id || msg._id)
            ? { ...msg, status: "READ", read: true }
            : msg
        )
      );
      messageIds.forEach(messageId => {
        if (socketRef.current && selectedContact) {
          socketRef.current.emit('chat:status', {
            messageId,
            status: 'read',
            recipientId: selectedContact.user_id
          });
        }
      });
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const response = isDoctor
        ? await apiClient.getDoctorPatients()
        : await apiClient.getAvailableDoctors();

      if (response.success) {
        setContacts(response.data || []);
      }
    } catch (error: any) {
      console.error("Failed to fetch contacts", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchMessages = async (contactId: string) => {
    try {
      setLoadingMessages(true);
      const response = isDoctor
        ? await apiClient.getDoctorChatHistory(contactId)
        : await apiClient.getPatientChatHistory(contactId);

      if (response.success) {
        const msgs = response.data || [];
        setMessages(msgs);

        const myRole = isDoctor ? "DOCTOR" : "PATIENT";
        const undeliveredIds = msgs
          .filter((m: any) => m.sender_role !== myRole && (!m.status || m.status === "SENT"))
          .map((m: any) => m.id || m._id);

        if (undeliveredIds.length > 0) {
          markAsDelivered(undeliveredIds);
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedContact) return;

    const messageText = input.trim();
    setInput("");

    try {
      const response = isDoctor
        ? await apiClient.sendDoctorChatMessage(selectedContact.id, messageText)
        : await apiClient.sendPatientChatMessage(selectedContact.id, messageText);

      if (response.success) {
        const savedMessage = response.data; // This is the message from database with proper ID
        const newMessage = {
          ...savedMessage,
          id: savedMessage.id || savedMessage._id,
          text: savedMessage.text || messageText,
          sender_role: isDoctor ? "DOCTOR" : "PATIENT",
          created_at: savedMessage.created_at || new Date().toISOString(),
          status: "SENT"
        };
        
        console.log('Sent message with ID:', newMessage.id);
        setMessages((prev) => [...prev, newMessage]);

        emitChatMessage({
          senderId: user?.id || '',
          recipientId: selectedContact.user_id,
          message: newMessage
        });

        scrollToBottom();
      }
    } catch (error) {
      toast.error("Failed to send message");
      setInput(messageText);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!selectedContact) return;

    emitTyping({
      senderId: user?.id || '',
      recipientId: selectedContact.user_id,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTyping({
        senderId: user?.id || '',
        recipientId: selectedContact.user_id,
        isTyping: false
      });
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getMessageStatusIcon = (msg: any) => {
    const myRole = isDoctor ? "DOCTOR" : "PATIENT";
    if (msg.sender_role !== myRole) return null;

    switch (msg.status) {
      case "READ":
        return <CheckCheck className="w-3 h-3 text-emerald-400" />;
      case "DELIVERED":
        return <CheckCheck className="w-3 h-3 text-emerald-300" />;
      case "SENT":
        return <Check className="w-3 h-3 text-emerald-300" />;
      default:
        return <Circle className="w-2 h-2 text-emerald-300" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          height: isMinimized ? "60px" : "500px"
        }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-4 right-4 w-96 bg-white rounded-2xl shadow-2xl z-[99999] overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5" />
            <div>
              <h3 className="font-bold">
                {selectedContact ? selectedContact.name : isDoctor ? "Patients" : "Doctors"}
              </h3>
              {selectedContact && (
                <p className="text-xs text-emerald-100 flex items-center gap-1">
                  <Circle className={`w-2 h-2 fill-current ${isOnline ? "text-green-300" : "text-slate-400"}`} />
                  {isOnline ? "Online" : "Offline"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-white/20 p-1.5 rounded-lg transition"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="hover:bg-white/20 p-1.5 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex flex-col h-[436px]">
            {!selectedContact ? (
              /* Contact List */
              <div className="flex-1 overflow-y-auto p-4">
                {loadingContacts ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No {isDoctor ? "patients" : "doctors"} available</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {isDoctor ? "Patients with alerts or appointments will appear here" : "Available doctors will appear here"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">
                      Select a {isDoctor ? "patient" : "doctor"} ({contacts.length})
                    </p>
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        className="w-full p-3 hover:bg-emerald-50 rounded-xl transition text-left border border-transparent hover:border-emerald-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 truncate">{contact.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {isDoctor ? contact.email : (contact.specialization || "General")}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Chat Interface */
              <>
                {/* Back Button */}
                <div className="p-3 border-b border-slate-200 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setMessages([]);
                    }}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    ← Back to {isDoctor ? "patients" : "doctors"}
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No messages yet</p>
                      <p className="text-xs text-slate-400 mt-1">Start a conversation</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const myRole = isDoctor ? "DOCTOR" : "PATIENT";
                      const isMine = msg.sender_role === myRole;
                      return (
                        <div
                          key={idx}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                              isMine
                                ? "bg-emerald-600 text-white rounded-br-sm"
                                : "bg-white text-slate-800 rounded-bl-sm shadow-sm"
                            }`}
                          >
                            <p className="text-sm break-words">{msg.text || msg.content}</p>
                            <div className="flex items-center gap-1 justify-end mt-1">
                              <p
                                className={`text-xs ${
                                  isMine ? "text-emerald-200" : "text-slate-400"
                                }`}
                              >
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              {getMessageStatusIcon(msg)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white text-slate-800 rounded-bl-sm shadow-sm px-4 py-2 rounded-2xl">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-slate-200 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={handleInputChange}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:border-emerald-500 text-sm"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim()}
                      className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
