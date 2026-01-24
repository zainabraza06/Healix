import { Server } from 'socket.io';

let ioInstance = null;

export const initSocket = (server, corsOrigins = ['http://localhost:3000']) => {
  ioInstance = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  ioInstance.on('connection', (socket) => {
    // Client should emit 'join' with { userId, role, doctorId, patientId }
    socket.on('join', (payload = {}) => {
      const { userId, role, doctorId, patientId } = payload;
      if (role === 'DOCTOR' && doctorId) {
        socket.join(`doctor:${doctorId}`);
      }
      if (role === 'PATIENT' && patientId) {
        socket.join(`patient:${patientId}`);
      }
    });

    socket.on('chat:send', ({ doctorId, patientId, message }) => {
      if (doctorId) ioInstance.to(`doctor:${doctorId}`).emit('chat:receive', { doctorId, patientId, message });
      if (patientId) ioInstance.to(`patient:${patientId}`).emit('chat:receive', { doctorId, patientId, message });
    });

    socket.on('disconnect', () => {});
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) throw new Error('Socket.io not initialized');
  return ioInstance;
};
