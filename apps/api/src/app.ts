import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import deploymentRoutes from './routes/deployments';
import apiKeyRoutes from './routes/apiKeys';
import auditLogRoutes from './routes/auditLogs';
import usageMetricRoutes from './routes/usageMetrics';
import { initializeDatabase } from './database';

const app = express();

let dbReady: Promise<void> | null = null;

async function ensureDatabase(): Promise<void> {
  if (!dbReady) {
    dbReady = initializeDatabase().catch((err) => {
      dbReady = null;
      throw err;
    });
  }
  return dbReady;
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin === 'https://cloudlane-dashboard.vercel.app' ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: false,
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// MongoDB (required for serverless cold starts; no-op if already connected)
app.use(async (req, res, next) => {
    if (
      req.method === 'OPTIONS' ||
      req.path === '/health' ||
      req.path.startsWith('/health/') ||
      req.path.includes('health')
    ) {
      return next();
    }
    try {
        await ensureDatabase();
        next();
    } catch (error) {
        console.error('Database connection failed:', error);
        const message = error instanceof Error ? error.message : 'Database unavailable';
        res.status(503).json({ error: message });
    }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/usage-metrics', usageMetricRoutes);

// Root
app.get('/', (_req, res) => {
    res.json({ message: 'Cloudlane API is running. See /api for endpoints.' });
});

// Health check
app.get('/health', (_req, res) => {
    const url = process.env.DATABASE_URL || '';
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      hasDatabaseUrl: Boolean(url),
      database: url.includes('mongodb.net') ? 'atlas' : url.includes('localhost') ? 'localhost' : url ? 'other' : 'missing',
    });
});

app.get('/health/db', (_req, res) => {
    const url = process.env.DATABASE_URL || '';
    res.json({
      status: 'ok',
      database: url.includes('mongodb.net') ? 'atlas-configured' : url.includes('localhost') ? 'localhost' : url ? 'other' : 'missing',
      hasDatabaseUrl: Boolean(url),
      note: 'This endpoint does not open Mongo (avoids Netlify 502). Sign in tests the real connection.',
    });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export default app;
