import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import deploymentRoutes from './routes/deployments';
import { initializeDatabase } from './database';

const app = express();

let dbReady: Promise<void> | null = null;

async function ensureDatabase(): Promise<void> {
  if (!dbReady) dbReady = initializeDatabase();
  return dbReady;
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// MongoDB (required for serverless cold starts; no-op if already connected)
app.use(async (req, res, next) => {
    if (req.path === '/health') return next();
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

// Root
app.get('/', (_req, res) => {
    res.json({ message: 'Cloudlane API is running. See /api for endpoints.' });
});

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export default app;
