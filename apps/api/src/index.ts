import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config from './config';
import authRoutes from './routes/auth';
import deploymentRoutes from './routes/deployments';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    // Do not exit process here; allow the server to start so serverless platforms
    // (like Vercel) don't treat this as a function crash. Routes that depend on
    // the database should handle missing DB connections gracefully.
  }

  app.listen(config.port, () => {
    console.log(`Cloudlane API running on port ${config.port}`);
    console.log(`Environment: ${config.environment}`);
  });
}

startServer();

export default app;
