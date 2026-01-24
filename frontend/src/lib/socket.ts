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
