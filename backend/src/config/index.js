import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:8080',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
};

export default config;
