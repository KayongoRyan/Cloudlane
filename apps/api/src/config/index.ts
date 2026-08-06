import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudlane',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  kubernetesConfigPath: process.env.KUBECONFIG || undefined,
  baseDomain: process.env.BASE_DOMAIN || 'cloudlane.run',
  iremboPayApiKey: process.env.IREMBOPAY_API_KEY || '',
  iremboPayApiUrl: process.env.IREMBOPAY_API_URL || 'https://api.irembopay.com',
  environment: process.env.NODE_ENV || 'development',
};

export default config;
