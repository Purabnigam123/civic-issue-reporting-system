import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import connectDB from './config/database';
import env from './config/env';
import authRoutes from './routes/authRoutes';
import complaintRoutes from './routes/complaintRoutes';
import { sendError } from './utils/response';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev to avoid local port mismatch
    }
  },
  credentials: true,
}));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/complaints', complaintRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Civic Issue Reporting API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  sendError(res, 'Route not found', 404);
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);

  if (err instanceof SyntaxError) {
    sendError(res, 'Invalid JSON in request body', 400);
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    sendError(res, 'File too large. Maximum size is 10MB.', 400);
    return;
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    sendError(res, 'Too many files. Maximum is 5 files.', 400);
    return;
  }

  if (err.message && err.message.includes('File type')) {
    sendError(res, err.message, 400);
    return;
  }

  sendError(res, 'Internal server error', 500);
});

// Start server
const startServer = async () => {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`\n🏛️  Civic Issue Reporting API`);
    console.log(`   Server running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Client URL: ${env.CLIENT_URL}\n`);
  });
};

startServer();

export default app;
