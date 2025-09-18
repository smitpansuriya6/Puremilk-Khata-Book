// Enhanced Error Handling Utility
import config from '../config/config';

class ErrorHandler {
  static log(error, context = '') {
    if (config.enableDebug) {
      console.error(`[${context}] Error:`, error);
    }
    
    // In production, you might want to send errors to a logging service
    if (config.environment === 'production') {
      // Example: Send to logging service
      // logToService({ error: error.message, context, timestamp: new Date() });
    }
  }

  static handleApiError(error, context = 'API') {
    this.log(error, context);
    
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          localStorage.removeItem('token');
          window.location.href = '/login';
          return 'Please log in again';
        case 403:
          return 'You do not have permission to perform this action';
        case 404:
          return 'The requested resource was not found';
        case 422:
          return data.detail || 'Invalid data provided';
        case 429:
          return 'Too many requests. Please try again later';
        case 500:
          return 'Server error. Please try again later';
        default:
          return data.detail || 'An unexpected error occurred';
      }
    } else if (error.request) {
      // Network error or timeout
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return 'Request timed out. Please check if the backend server is running on http://localhost:5000';
      }
      return 'Network error. Please check your connection and ensure the backend server is running';
    } else {
      // Other error
      return 'An unexpected error occurred';
    }
  }

  static handleValidationError(errors) {
    if (Array.isArray(errors)) {
      return errors.map(err => err.msg || err.message).join(', ');
    }
    return 'Validation failed';
  }
}

export default ErrorHandler;