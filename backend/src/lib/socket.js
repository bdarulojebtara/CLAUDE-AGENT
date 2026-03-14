import { Server } from 'socket.io';
import env from './env.js';

let io = null;

export function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Autenticar socket com JWT
    socket.on('authenticate', (data) => {
      if (data.userId) {
        socket.userId = data.userId;
        socket.empresaId = data.empresaId;
        socket.join(`empresa_${data.empresaId}`);
        socket.join(`user_${data.userId}`);
        console.log(`✅ Socket autenticado: user ${data.userId}, empresa ${data.empresaId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  console.log('✅ Socket.io inicializado');
  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io não foi inicializado! Chame initializeSocket() primeiro.');
  }
  return io;
}

// Emitir evento para todos os usuários de uma empresa
export function emitToEmpresa(empresaId, event, data) {
  if (io) {
    io.to(`empresa_${empresaId}`).emit(event, data);
  }
}

// Emitir evento para um usuário específico
export function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

// Emitir evento global para todos conectados
export function emitGlobal(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

export default { initializeSocket, getIO, emitToEmpresa, emitToUser, emitGlobal };
