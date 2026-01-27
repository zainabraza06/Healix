import { Server } from 'socket.io';

let ioInstance = null;
// Track online users strictly by userId
const onlineUsers = new Map(); // userId -> { socketId, role, doctorId, patientId }

const normalizeId = (id) => (id ? String(id) : null);

export const initSocket = (server, corsOrigins = ['http://localhost:3000']) => {
  ioInstance = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Client must emit 'join' with { userId, role, doctorId, patientId }
    socket.on('join', (payload = {}) => {
      const { userId, role, doctorId, patientId } = payload;
      const userKey = normalizeId(userId);

      if (!userKey) {
        console.warn('join ignored: missing userId', payload);
        return;
      }

      // Track online user
      onlineUsers.set(userKey, { socketId: socket.id, role, doctorId, patientId });
      console.log(`User ${userKey} (${role}) is now online`);

      // Always join a user-scoped room so we can emit by userId without needing doctor/patient ids
      socket.join(`user:${userKey}`);

      // Join per-role rooms using user-scoped ids only
      if (role === 'DOCTOR' && doctorId) {
        socket.join(`doctor:${normalizeId(doctorId)}`);
      }
      if (role === 'PATIENT' && patientId) {
        socket.join(`patient:${normalizeId(patientId)}`);
      }

      // Broadcast online status
      if (role === 'DOCTOR') {
        ioInstance.emit('doctor:online', { doctorId, userId: userKey });
      } else if (role === 'PATIENT') {
        ioInstance.emit('patient:online', { patientId, userId: userKey });
      }
    });

    socket.on('chat:send', (payload) => {
      const { senderId, recipientId, message } = payload;
      const senderKey = normalizeId(senderId);
      const recipientKey = normalizeId(recipientId);
      console.log('chat:send received:', { senderId: senderKey, recipientId: recipientKey, onlineUsers: Array.from(onlineUsers.keys()) });

      if (!senderKey || !recipientKey) {
        console.warn('chat:send ignored: missing senderId or recipientId', payload);
        return;
      }

      const recipientUserData = onlineUsers.get(recipientKey);
      if (!recipientUserData) {
        console.log(`Recipient ${recipientKey} not online`);
        return;
      }

      ioInstance.to(recipientUserData.socketId).emit('chat:receive', { senderId: senderKey, recipientId: recipientKey, message });
      console.log(`Message relayed from ${senderKey} to ${recipientKey}`);
    });

    // Handle typing indicators
    socket.on('chat:typing', ({ senderId, recipientId, isTyping }) => {
      const recipientKey = normalizeId(recipientId);
      const senderKey = normalizeId(senderId);
      if (!recipientKey || !senderKey) return;
      const recipientUserData = onlineUsers.get(recipientKey);
      if (recipientUserData) {
        ioInstance.to(recipientUserData.socketId).emit('chat:typing', { senderId: senderKey, isTyping });
      }
    });

    // Handle message status updates (delivered/read)
    socket.on('chat:status', ({ messageId, status, recipientId }) => {
      const recipientKey = normalizeId(recipientId);
      if (!recipientKey) return;
      const senderUserData = onlineUsers.get(recipientKey);
      if (senderUserData) {
        ioInstance.to(senderUserData.socketId).emit('chat:status', { messageId, status });
      }
    });

    // Handle online status check request
    socket.on('chat:checkStatus', ({ userId }) => {
      const userKey = normalizeId(userId);
      if (!userKey) return;
      const isOnline = onlineUsers.has(userKey);
      socket.emit('chat:statusResponse', { userId: userKey, isOnline });
      console.log(`Status check for ${userKey}: ${isOnline ? 'online' : 'offline'}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      
      // Find and remove user from online list
      for (const [userId, userData] of onlineUsers.entries()) {
        if (userData.socketId === socket.id) {
          onlineUsers.delete(userId);
          console.log(`User ${userId} is now offline`);
          
          // Broadcast offline status
          ioInstance.emit('user:offline', { userId, role: userData.role });
          break;
        }
      }
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) throw new Error('Socket.io not initialized');
  return ioInstance;
};

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};
