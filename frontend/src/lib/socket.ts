import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

let socket: Socket | null = null;

export const connectSocket = (token?: string): Socket => {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    withCredentials: true,
    auth: token ? { token } : undefined,
  });
  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinRooms = (payload: { userId?: string; role: 'PATIENT' | 'DOCTOR' | 'ADMIN'; doctorId?: string; patientId?: string; }) => {
  if (!socket) return;
  socket.emit('join', payload);
};

export const onChatReceive = (handler: (data: any) => void) => {
  if (!socket) return;
  socket.on('chat:receive', handler);
};

export const offChatReceive = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('chat:receive', handler);
  else socket.off('chat:receive');
};

export const onCriticalVitals = (handler: (data: any) => void) => {
  if (!socket) return;
  socket.on('criticalVitals', handler);
};

export const offCriticalVitals = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('criticalVitals', handler);
  else socket.off('criticalVitals');
};

export const onAlertAssigned = (handler: (data: any) => void) => {
  if (!socket) return;
  socket.on('alert:assigned', handler);
};

export const offAlertAssigned = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('alert:assigned', handler);
  else socket.off('alert:assigned');
};

export const onAlertResolved = (handler: (data: any) => void) => {
  if (!socket) return;
  socket.on('alert:resolved', handler);
};

export const offAlertResolved = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('alert:resolved', handler);
  else socket.off('alert:resolved');
};

export const emitChatMessage = (payload: { senderId: string; recipientId: string; message: any }) => {
  if (!socket) return;
  socket.emit('chat:send', payload);
};

export const emitTyping = (payload: { senderId: string; recipientId: string; isTyping: boolean }) => {
  if (!socket) return;
  socket.emit('chat:typing', payload);
};

export const onTyping = (handler: (data: any) => void) => {
  if (!socket) return;
  socket.on('chat:typing', handler);
};

export const offTyping = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('chat:typing', handler);
  else socket.off('chat:typing');
};

export const emitMessageStatus = (payload: { messageId: string; status: 'delivered' | 'read' }) => {
  if (!socket) return;
  socket.emit('chat:status', payload);
};

export const onMessageStatus = (handler: (data: any) => void) => {
  if (!socket) return;
  socket.on('chat:status', handler);
};

export const offMessageStatus = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('chat:status', handler);
  else socket.off('chat:status');
};

export const checkUserStatus = (userId: string) => {
  if (!socket) return;
  socket.emit('chat:checkStatus', { userId });
};

export const onStatusResponse = (handler: (data: { userId: string; isOnline: boolean }) => void) => {
  if (!socket) return;
  socket.on('chat:statusResponse', handler);
};

export const offStatusResponse = (handler?: (data: any) => void) => {
  if (!socket) return;
  if (handler) socket.off('chat:statusResponse', handler);
  else socket.off('chat:statusResponse');
};
