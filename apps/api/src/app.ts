import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import deploymentRoutes from './routes/deployments';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
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
