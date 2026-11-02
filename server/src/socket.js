const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';
let io = null;

/**
 * Khởi tạo Socket.io Server gắn với HTTP Server Express
 */
exports.initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Middleware xác thực JWT token trong handshake
  io.use((socket, next) => {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (!rawToken) {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id || socket.user?._id;
    if (userId) {
      socket.join(`user_${userId}`);
    }
  });

  return io;
};

/**
 * Lấy instance của io để phát sự kiện realtime
 */
exports.getIO = () => io;
