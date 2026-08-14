import dotenv from 'dotenv';

dotenv.config();

const isNetlify = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    (isNetlify ? '' : 'mongodb://localhost:27017/cloudlane'),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  kubernetesConfigPath: process.env.KUBECONFIG || undefined,
  baseDomain: process.env.BASE_DOMAIN || 'cloudlane.run',
  iremboPayApiKey: process.env.IREMBOPAY_API_KEY || '',
  iremboPayApiUrl: process.env.IREMBOPAY_API_URL || 'https://api.irembopay.com',
  environment: process.env.NODE_ENV || 'development',
  isNetlify,
};

export default config;
export { config };
