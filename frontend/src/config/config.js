// Production Configuration
const config = {
  development: {
    apiUrl: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api',
    enableDebug: true,
    logLevel: 'debug',
    timeout: 15000, // Increased timeout for development
    retryAttempts: 3
  },
  production: {
    apiUrl: process.env.REACT_APP_BACKEND_URL,
    enableDebug: false,
    logLevel: 'error',
    timeout: 10000,
    retryAttempts: 2
  }
};

const environment = process.env.NODE_ENV || 'development';

export default {
  ...config[environment],
  environment,
  version: '2.0.0'
};