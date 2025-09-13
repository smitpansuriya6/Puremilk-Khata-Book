import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from "react";
import "./App.css";
import axios from "axios";
import config from "./config/config";
import ErrorHandler from "./utils/errorHandler";
import MonthlyMilkCalendar from "./components/MonthlyMilkCalendar";

// Configure axios defaults
axios.defaults.timeout = config.timeout || 10000;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Request interceptor for auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

const API = config.apiUrl;
console.log('API URL:', API);

// Auth Context with enhanced security
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const clearError = useCallback(() => setError(''), []);

  const login = useCallback(async (email, password) => {
    try {
      setError('');
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      
      return { success: true };
    } catch (error) {
      const errorMessage = ErrorHandler.handleApiError(error, 'Login');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      setError('');
      const response = await axios.post(`${API}/auth/register`, userData);
      const { token: newToken, user: newUser } = response.data;
      
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      
      return { success: true };
    } catch (error) {
      const errorMessage = ErrorHandler.handleApiError(error, 'Registration');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError('');
    localStorage.removeItem('token');
  }, []);

  const refreshUser = useCallback(async () => {
    if (token) {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch (error) {
        ErrorHandler.log(error, 'Refresh User');
        logout();
      }
    }
  }, [token, logout]);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`);
          setUser(response.data);
        } catch (error) {
          ErrorHandler.log(error, 'Initial Auth Check');
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError
  }), [user, token, loading, error, login, register, logout, refreshUser, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Enhanced API utility with retry logic
const apiCall = async (endpoint, options = {}, retries = config.retryAttempts || 2) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    url: `${API}${endpoint}`,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      ...options.headers
    },
    timeout: config.timeout || 10000,
    ...options
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios(defaultOptions);
    } catch (error) {
      if (attempt === retries || error.response?.status < 500) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
};

// Input validation utilities
const ValidationUtils = {
  email: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  phone: (phone) => {
    const re = /^\+?[1-9]\d{1,14}$/;
    return re.test(phone.replace(/[\s()-]/g, ''));
  },
  password: (password) => {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  },
  name: (name) => {
    return name.length >= 2 && name.length <= 100;
  },
  quantity: (quantity) => {
    return quantity > 0 && quantity <= 50;
  },
  rate: (rate) => {
    return rate > 0 && rate <= 1000;
  }
};

// Enhanced components with better UX
const LoadingSpinner = ({ size = 'medium' }) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="flex justify-center items-center">
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
    </div>
  );
};

const ErrorMessage = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex justify-between items-center">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-red-500 hover:text-red-700">
          ×
        </button>
      )}
    </div>
  );
};

const SuccessMessage = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex justify-between items-center">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-green-500 hover:text-green-700">
          ×
        </button>
      )}
    </div>
  );
};

const LoginForm = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'admin'
  });
  const [validationErrors, setValidationErrors] = useState({});
  const { login, register, error, clearError } = useAuth();

  const validateLoginForm = () => {
    const errors = {};
    if (!ValidationUtils.email(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    return errors;
  };

  const validateRegisterForm = () => {
    const errors = {};
    if (!ValidationUtils.email(registerData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!ValidationUtils.password(registerData.password)) {
      errors.password = 'Password must be at least 8 characters with letters and numbers';
    }
    if (!ValidationUtils.name(registerData.name)) {
      errors.name = 'Name must be between 2 and 100 characters';
    }
    if (!ValidationUtils.phone(registerData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    return errors;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    const errors = validateLoginForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    setLocalError('');
    setValidationErrors({});
    clearError();

    const result = await login(formData.email, formData.password);
    setLoading(false);

    if (!result.success) {
      setLocalError(result.error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    const errors = validateRegisterForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    setLocalError('');
    setValidationErrors({});
    clearError();

    const result = await register(registerData);
    setLoading(false);

    if (!result.success) {
      setLocalError(result.error);
    }
  };

  const clearErrors = () => {
    setLocalError('');
    setValidationErrors({});
    clearError();
  };

  if (isRegistering) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🥛 PureMilk</h1>
            <p className="text-gray-600">Register for Dairy Management</p>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-6">
            <ErrorMessage message={localError || error} onClose={clearErrors} />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={registerData.name}
                onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                required
                disabled={loading}
              />
              {validationErrors.name && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={registerData.email}
                onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                required
                disabled={loading}
              />
              {validationErrors.email && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={registerData.phone}
                onChange={(e) => setRegisterData({...registerData, phone: e.target.value})}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                required
                disabled={loading}
              />
              {validationErrors.phone && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={registerData.role}
                onChange={(e) => setRegisterData({...registerData, role: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="admin">Admin (Milkman)</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                required
                disabled={loading}
              />
              {validationErrors.password && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? <LoadingSpinner size="small" /> : 'Register'}
            </button>
          </form>
          
          <div className="text-center mt-6">
            <button
              onClick={() => {
                setIsRegistering(false);
                clearErrors();
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
              disabled={loading}
            >
              Already have an account? Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🥛 PureMilk</h1>
          <p className="text-gray-600">Login to Dairy Management System</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <ErrorMessage message={localError || error} onClose={clearErrors} />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              required
              disabled={loading}
            />
            {validationErrors.email && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.password ? 'border-red-300' : 'border-gray-300'
              }`}
              required
              disabled={loading}
            />
            {validationErrors.password && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="small" /> : 'Login'}
          </button>
        </form>
        
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsRegistering(true);
              clearErrors();
            }}
            className="text-blue-600 hover:text-blue-800 font-medium"
            disabled={loading}
          >
            Don't have an account? Register
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const fetchStats = useCallback(async () => {
    try {
      setError('');
      const response = await apiCall('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      const errorMessage = ErrorHandler.handleApiError(error, 'Dashboard Stats');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {isAdmin ? 'Admin Dashboard' : 'My Dashboard'}
        </h2>
        <p className="text-gray-600">
          {isAdmin ? 'Overview of your dairy business' : 'Overview of your milk delivery service'}
        </p>
      </div>

      <ErrorMessage message={error} onClose={() => setError('')} />
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {isAdmin ? 'Total Customers' : 'My Account'}
                </p>
                <p className="text-3xl font-bold text-blue-600">{stats.total_customers}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {isAdmin ? 'Active Customers' : 'Account Status'}
                </p>
                <p className="text-3xl font-bold text-green-600">{stats.active_customers}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Deliveries</p>
                <p className="text-3xl font-bold text-orange-600">{stats.today_deliveries}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <span className="text-2xl">🚛</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Deliveries</p>
                <p className="text-3xl font-bold text-red-600">{stats.pending_deliveries}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <span className="text-2xl">⏰</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {isAdmin ? "Today's Revenue" : "Today's Payments"}
                </p>
                <p className="text-3xl font-bold text-purple-600">₹{stats.today_revenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {isAdmin ? "Monthly Revenue" : "Monthly Payments"}
                </p>
                <p className="text-3xl font-bold text-indigo-600">₹{stats.monthly_revenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-full">
                <span className="text-2xl">📈</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                <p className="text-3xl font-bold text-yellow-600">₹{stats.pending_payments?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <span className="text-2xl">💳</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !stats && !error && (
        <div className="text-center py-12">
          <p className="text-gray-600">No data available</p>
          <button 
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    milk_type: 'cow',
    daily_quantity: 1.0,
    rate_per_liter: 50.0,
    morning_delivery: true,
    evening_delivery: false
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      milk_type: 'cow',
      daily_quantity: 1.0,
      rate_per_liter: 50.0,
      morning_delivery: true,
      evening_delivery: false
    });
    setValidationErrors({});
    setEditingCustomer(null);
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setError('');
      const response = await apiCall('/customers');
      setCustomers(response.data);
    } catch (error) {
      const errorMessage = ErrorHandler.handleApiError(error, 'Customer Management');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const validateForm = () => {
    const errors = {};
    
    if (!ValidationUtils.name(formData.name)) {
      errors.name = 'Name must be between 2 and 100 characters';
    }
    if (!ValidationUtils.email(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!ValidationUtils.phone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    if (formData.address.length < 10 || formData.address.length > 500) {
      errors.address = 'Address must be between 10 and 500 characters';
    }
    if (!ValidationUtils.quantity(formData.daily_quantity)) {
      errors.daily_quantity = 'Quantity must be between 0 and 50 liters';
    }
    if (!ValidationUtils.rate(formData.rate_per_liter)) {
      errors.rate_per_liter = 'Rate must be between 0 and ₹1000 per liter';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setFormLoading(true);
    setError('');
    setSuccess('');
    setValidationErrors({});

    try {
      if (editingCustomer) {
        await apiCall(`/customers/${editingCustomer.id}`, {
          method: 'PUT',
          data: formData
        });
        setSuccess('Customer updated successfully');
      } else {
        await apiCall('/customers', {
          method: 'POST',
          data: formData
        });
        setSuccess('Customer created successfully');
      }
      
      setShowForm(false);
      resetForm();
      fetchCustomers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      const errorMessage = ErrorHandler.handleApiError(error, 'Customer Form');
      setError(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      milk_type: customer.milk_type,
      daily_quantity: customer.daily_quantity,
      rate_per_liter: customer.rate_per_liter,
      morning_delivery: customer.morning_delivery,
      evening_delivery: customer.evening_delivery
    });
    setShowForm(true);
    setError('');
    setValidationErrors({});
  };

  const handleDelete = async (customerId, customerName) => {
    if (window.confirm(`Are you sure you want to delete ${customerName}? This action cannot be undone.`)) {
      try {
        setError('');
        await apiCall(`/customers/${customerId}`, { method: 'DELETE' });
        setSuccess('Customer deleted successfully');
        fetchCustomers();
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        const errorMessage = ErrorHandler.handleApiError(error, 'Delete Customer');
        setError(errorMessage);
      }
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Customer Management</h2>
          <p className="text-gray-600">Manage your milk delivery customers</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
        >
          Add New Customer
        </button>
      </div>

      <ErrorMessage message={error} onClose={() => setError('')} />
      <SuccessMessage message={success} onClose={() => setSuccess('')} />

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search customers by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <ErrorMessage message={error} onClose={() => setError('')} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    disabled={formLoading}
                  />
                  {validationErrors.name && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    disabled={formLoading}
                  />
                  {validationErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    disabled={formLoading}
                  />
                  {validationErrors.phone && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milk Type</label>
                  <select
                    value={formData.milk_type}
                    onChange={(e) => setFormData({...formData, milk_type: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={formLoading}
                  >
                    <option value="cow">Cow Milk</option>
                    <option value="buffalo">Buffalo Milk</option>
                    <option value="goat">Goat Milk</option>
                    <option value="mixed">Mixed Milk</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Daily Quantity (Liters) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={formData.daily_quantity}
                    onChange={(e) => setFormData({...formData, daily_quantity: parseFloat(e.target.value) || 0})}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.daily_quantity ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    disabled={formLoading}
                  />
                  {validationErrors.daily_quantity && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.daily_quantity}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rate per Liter (₹) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1000"
                    value={formData.rate_per_liter}
                    onChange={(e) => setFormData({...formData, rate_per_liter: parseFloat(e.target.value) || 0})}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.rate_per_liter ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    disabled={formLoading}
                  />
                  {validationErrors.rate_per_liter && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.rate_per_liter}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows="3"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.address ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                  disabled={formLoading}
                />
                {validationErrors.address && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.address}</p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.morning_delivery}
                    onChange={(e) => setFormData({...formData, morning_delivery: e.target.checked})}
                    className="mr-3 h-5 w-5 text-blue-600"
                    disabled={formLoading}
                  />
                  <label className="text-sm font-medium text-gray-700">Morning Delivery</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.evening_delivery}
                    onChange={(e) => setFormData({...formData, evening_delivery: e.target.checked})}
                    className="mr-3 h-5 w-5 text-blue-600"
                    disabled={formLoading}
                  />
                  <label className="text-sm font-medium text-gray-700">Evening Delivery</label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                    setError('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-200"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {formLoading ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    editingCustomer ? 'Update Customer' : 'Add Customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {searchTerm ? 'No customers found matching your search.' : 'No customers found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Name</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Contact</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Milk Type</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Daily Qty</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Rate/L</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Status</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{customer.address}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{customer.email}</div>
                        <div className="text-gray-500">{customer.phone}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="capitalize bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {customer.milk_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-700">{customer.daily_quantity}L</td>
                    <td className="py-4 px-6 text-gray-700">₹{customer.rate_per_liter}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        customer.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {customer.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id, customer.name)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Monthly Calendar Component for Milk Delivery Tracking
const MonthlyCalendarView = ({ customer }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deliveries, setDeliveries] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [dailyQuantities, setDailyQuantities] = useState({});
  
  // New state for morning/evening editing
  const [editingMorning, setEditingMorning] = useState(null); // day number being edited for morning
  const [editingEvening, setEditingEvening] = useState(null); // day number being edited for evening
  const [editMorningQuantity, setEditMorningQuantity] = useState('');
  const [editEveningQuantity, setEditEveningQuantity] = useState('');
  
  // Check if current user is admin (you can modify this logic based on your auth system)
  const isAdmin = true; // For now, set to true. Replace with actual admin check logic

  // Get days in current month
  const getDaysInMonth = useCallback((date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, []);

  // Fetch deliveries for the current month
  const fetchMonthlyDeliveries = useCallback(async () => {
    if (!customer) return;
    
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const response = await axios.get(`${API}/deliveries?customer_id=${customer.id}&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`);
      
      // Convert array to object with date as key
      const deliveryMap = {};
      response.data.forEach(delivery => {
        const date = new Date(delivery.delivery_date).getDate();
        deliveryMap[date] = delivery;
      });
      
      setDeliveries(deliveryMap);
      console.log('Fetched deliveries:', deliveryMap);
      
      // Trigger population after deliveries are loaded
      setTimeout(() => {
        if (customer) populateDefaultQuantities();
      }, 100);
      
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      alert('Error loading deliveries: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  }, [customer, currentDate]);

  useEffect(() => {
    fetchMonthlyDeliveries();
  }, [fetchMonthlyDeliveries]);

  // Auto-populate when customer or month changes
  useEffect(() => {
    if (customer) {
      populateDefaultQuantities();
    } else {
      setDailyQuantities({}); // Clear when no customer selected
    }
  }, [customer, currentDate]);

  // Auto-populate calendar with customer's morning/evening deliveries from current date onwards
  const populateDefaultQuantities = useCallback(() => {
    if (!customer) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get current date to determine from which day to populate
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const newQuantities = {};
    
    // Check if viewing current month or future month
    const isCurrentMonth = (year === currentYear && month === currentMonth);
    const isFutureMonth = (year > currentYear || (year === currentYear && month > currentMonth));
    
    // Only populate for current month (from today) or future months (full month)
    if (isCurrentMonth) {
      // For current month: populate from today onwards
      for (let day = currentDay; day <= daysInMonth; day++) {
        const morningKey = `${year}-${month}-${day}-morning`;
        const eveningKey = `${year}-${month}-${day}-evening`;
        
        // Populate morning delivery if customer has morning delivery enabled
        if (customer.morning_delivery && !deliveries[day]?.morning) {
          newQuantities[morningKey] = {
            quantity: customer.daily_quantity,
            customer: customer,
            date: `${year}-${month}-${day}`,
            time: 'morning',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
        
        // Populate evening delivery if customer has evening delivery enabled
        if (customer.evening_delivery && !deliveries[day]?.evening) {
          newQuantities[eveningKey] = {
            quantity: customer.daily_quantity,
            customer: customer,
            date: `${year}-${month}-${day}`,
            time: 'evening',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
      }
    } else if (isFutureMonth) {
      // For future months: populate entire month
      for (let day = 1; day <= daysInMonth; day++) {
        const morningKey = `${year}-${month}-${day}-morning`;
        const eveningKey = `${year}-${month}-${day}-evening`;
        
        // Populate morning delivery if customer has morning delivery enabled
        if (customer.morning_delivery && !deliveries[day]?.morning) {
          newQuantities[morningKey] = {
            quantity: customer.daily_quantity,
            customer: customer,
            date: `${year}-${month}-${day}`,
            time: 'morning',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
        
        // Populate evening delivery if customer has evening delivery enabled
        if (customer.evening_delivery && !deliveries[day]?.evening) {
          newQuantities[eveningKey] = {
            quantity: customer.daily_quantity,
            customer: customer,
            date: `${year}-${month}-${day}`,
            time: 'evening',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
      }
    }
    // For past months: don't populate anything (newQuantities remains empty)
    
    setDailyQuantities(newQuantities);
  }, [customer, currentDate, deliveries]);

  // Generate date key for daily quantities
  const getDateKey = (day) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return `${year}-${month}-${day}`;
  };

  // Handle click on morning delivery
  const handleMorningClick = (day) => {
    if (!customer || !day || !isAdmin) return;
    
    // Prevent editing in past months
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const viewingYear = currentDate.getFullYear();
    const viewingMonth = currentDate.getMonth();
    
    const isPastMonth = (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth));
    if (isPastMonth) {
      alert('Cannot edit deliveries in past months');
      return;
    }
    
    // For current month, prevent editing past dates
    const isCurrentMonth = (viewingYear === currentYear && viewingMonth === currentMonth);
    if (isCurrentMonth && day < today.getDate()) {
      alert('Cannot edit past dates in current month');
      return;
    }
    
    setEditingMorning(day);
    const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
    const existingMorning = deliveries[day]?.morning;
    const morningQuantity = dailyQuantities[morningKey];
    
    if (existingMorning) {
      setEditMorningQuantity(existingMorning.quantity.toString());
    } else if (morningQuantity) {
      setEditMorningQuantity(morningQuantity.quantity.toString());
    } else {
      setEditMorningQuantity(customer.daily_quantity.toString());
    }
  };

  // Handle click on evening delivery
  const handleEveningClick = (day) => {
    if (!customer || !day || !isAdmin) return;
    
    // Prevent editing in past months
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const viewingYear = currentDate.getFullYear();
    const viewingMonth = currentDate.getMonth();
    
    const isPastMonth = (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth));
    if (isPastMonth) {
      alert('Cannot edit deliveries in past months');
      return;
    }
    
    // For current month, prevent editing past dates
    const isCurrentMonth = (viewingYear === currentYear && viewingMonth === currentMonth);
    if (isCurrentMonth && day < today.getDate()) {
      alert('Cannot edit past dates in current month');
      return;
    }
    
    setEditingEvening(day);
    const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
    const existingEvening = deliveries[day]?.evening;
    const eveningQuantity = dailyQuantities[eveningKey];
    
    if (existingEvening) {
      setEditEveningQuantity(existingEvening.quantity.toString());
    } else if (eveningQuantity) {
      setEditEveningQuantity(eveningQuantity.quantity.toString());
    } else {
      setEditEveningQuantity(customer.daily_quantity.toString());
    }
  };

  // Handle morning delivery save
  const handleMorningSave = async (day) => {
    if (!customer || !editMorningQuantity || !isAdmin) return;
    
    const numericValue = parseFloat(editMorningQuantity);
    if (isNaN(numericValue) || numericValue <= 0) return;
    
    const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
    
    // If there's an existing morning delivery, update it via API
    if (deliveries[day]?.morning) {
      try {
        const response = await axios.put(`${API}/deliveries/${deliveries[day].morning.id}`, {
          quantity: numericValue
        });
        console.log('Morning update response:', response);
        setEditingMorning(null);
        setEditMorningQuantity('');
        await fetchMonthlyDeliveries();
      } catch (error) {
        console.error('Error updating morning delivery:', error);
        alert('Error saving morning delivery: ' + (error.response?.data?.detail || error.message));
      }
    } else {
      // Update local daily quantities for display
      setDailyQuantities(prev => ({
        ...prev,
        [morningKey]: {
          quantity: numericValue,
          customer: customer,
          date: `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`,
          time: 'morning',
          isDefault: false,
          addedAt: new Date().toISOString()
        }
      }));
      setEditingMorning(null);
      setEditMorningQuantity('');
    }
  };

  // Handle evening delivery save
  const handleEveningSave = async (day) => {
    if (!customer || !editEveningQuantity || !isAdmin) return;
    
    const numericValue = parseFloat(editEveningQuantity);
    if (isNaN(numericValue) || numericValue <= 0) return;
    
    const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
    
    // If there's an existing evening delivery, update it via API
    if (deliveries[day]?.evening) {
      try {
        const response = await axios.put(`${API}/deliveries/${deliveries[day].evening.id}`, {
          quantity: numericValue
        });
        console.log('Evening update response:', response);
        setEditingEvening(null);
        setEditEveningQuantity('');
        await fetchMonthlyDeliveries();
      } catch (error) {
        console.error('Error updating evening delivery:', error);
        alert('Error saving evening delivery: ' + (error.response?.data?.detail || error.message));
      }
    } else {
      // Update local daily quantities for display
      setDailyQuantities(prev => ({
        ...prev,
        [eveningKey]: {
          quantity: numericValue,
          customer: customer,
          date: `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`,
          time: 'evening',
          isDefault: false,
          addedAt: new Date().toISOString()
        }
      }));
      setEditingEvening(null);
      setEditEveningQuantity('');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getDaysInMonth(currentDate);

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  if (!customer) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Select a customer to view monthly delivery calendar</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
          <p className="text-sm text-gray-500">Monthly Delivery Calendar</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            ← Previous
          </button>
          
          <h3 className="text-lg font-semibold text-gray-900 min-w-[150px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {customer && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-green-800">
              <span className="font-semibold">Morning/Evening Calendar:</span> Shows separate morning 🌅 and evening 🌙 deliveries. {isAdmin ? 'Click quantities to edit (Admin only)' : 'Read-only view'}. Blue = auto-filled, Green = recorded.
            </p>
          </div>
        </div>
      )}

      {/* Customer Info - Only show when customer is selected */}
      {customer && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Daily Quantity</p>
              <p className="font-semibold text-gray-900">{customer.daily_quantity}L</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Rate per Liter</p>
              <p className="font-semibold text-gray-900">₹{customer.rate_per_liter}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Milk Type</p>
              <p className="font-semibold text-gray-900 capitalize">{customer.milk_type}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Monthly Target</p>
              <p className="font-semibold text-gray-900">{(customer.daily_quantity * days.filter(d => d !== null).length).toFixed(1)}L</p>
            </div>
          </div>
          
          {/* Delivery Preferences */}
          <div className="flex justify-center space-x-6 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🌅</span>
              <span className={`text-sm font-medium ${customer.morning_delivery ? 'text-green-600' : 'text-gray-400'}`}>
                Morning Delivery: {customer.morning_delivery ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🌙</span>
              <span className={`text-sm font-medium ${customer.evening_delivery ? 'text-blue-600' : 'text-gray-400'}`}>
                Evening Delivery: {customer.evening_delivery ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-gray-100">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <div
              key={index}
              className={`min-h-[100px] p-2 border-b border-r border-gray-200 ${
                day === null ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {day && (
                <div className="h-full flex flex-col">
                  {/* Day number */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-900">{day}</span>
                  </div>

                  {/* Morning/Evening Delivery info */}
                  <div className="flex-1 space-y-1">
                    {/* Morning Delivery */}
                    {customer && customer.morning_delivery && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-1">
                        <div className="text-xs font-semibold text-yellow-700 mb-1">🌅 Morning</div>
                        {editingMorning === day ? (
                          <div>
                            <input
                              type="number"
                              step="0.1"
                              value={editMorningQuantity}
                              onChange={(e) => setEditMorningQuantity(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleMorningSave(day);
                                } else if (e.key === 'Escape') {
                                  setEditingMorning(null);
                                  setEditMorningQuantity('');
                                }
                              }}
                              onBlur={() => handleMorningSave(day)}
                              className="w-full p-1 text-xs border border-yellow-300 rounded"
                              placeholder="Morning qty"
                              autoFocus
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => handleMorningSave(day)}
                                className="flex-1 px-1 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMorning(null);
                                  setEditMorningQuantity('');
                                }}
                                className="flex-1 px-1 py-0.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => isAdmin && handleMorningClick(day)} className={isAdmin ? 'cursor-pointer hover:bg-yellow-100' : ''}>
                            {(() => {
                              const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
                              const morningQuantity = dailyQuantities[morningKey];
                              const morningDelivery = deliveries[day]?.morning;
                              
                              // Check if this is a past month or past date in current month
                              const today = new Date();
                              const currentMonth = today.getMonth();
                              const currentYear = today.getFullYear();
                              const viewingYear = currentDate.getFullYear();
                              const viewingMonth = currentDate.getMonth();
                              
                              const isPastMonth = (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth));
                              const isPastDate = (viewingYear === currentYear && viewingMonth === currentMonth && day < today.getDate());
                              const canEdit = isAdmin && !isPastMonth && !isPastDate;
                              
                              if (morningDelivery) {
                                return (
                                  <div>
                                    <div className="text-xs font-semibold text-green-600">
                                      {morningDelivery.quantity}L {canEdit && <span className="text-gray-400">✎</span>}
                                    </div>
                                    <div className={`text-xs px-1 py-0.5 rounded text-center ${
                                      morningDelivery.status === 'delivered' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {morningDelivery.status}
                                    </div>
                                  </div>
                                );
                              } else if (morningQuantity) {
                                return (
                                  <div>
                                    <div className="text-xs font-semibold text-blue-500">
                                      {morningQuantity.quantity}L {canEdit && <span className="text-gray-400">✎</span>}
                                    </div>
                                    <div className="text-xs text-gray-500">Auto-filled</div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-xs text-gray-400">
                                    No delivery {canEdit && <span className="text-blue-500">+ Add</span>}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Evening Delivery */}
                    {customer && customer.evening_delivery && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-1">
                        <div className="text-xs font-semibold text-blue-700 mb-1">🌙 Evening</div>
                        {editingEvening === day ? (
                          <div>
                            <input
                              type="number"
                              step="0.1"
                              value={editEveningQuantity}
                              onChange={(e) => setEditEveningQuantity(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleEveningSave(day);
                                } else if (e.key === 'Escape') {
                                  setEditingEvening(null);
                                  setEditEveningQuantity('');
                                }
                              }}
                              onBlur={() => handleEveningSave(day)}
                              className="w-full p-1 text-xs border border-blue-300 rounded"
                              placeholder="Evening qty"
                              autoFocus
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => handleEveningSave(day)}
                                className="flex-1 px-1 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingEvening(null);
                                  setEditEveningQuantity('');
                                }}
                                className="flex-1 px-1 py-0.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => isAdmin && handleEveningClick(day)} className={isAdmin ? 'cursor-pointer hover:bg-blue-100' : ''}>
                            {(() => {
                              const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
                              const eveningQuantity = dailyQuantities[eveningKey];
                              const eveningDelivery = deliveries[day]?.evening;
                              
                              // Check if this is a past month or past date in current month
                              const today = new Date();
                              const currentMonth = today.getMonth();
                              const currentYear = today.getFullYear();
                              const viewingYear = currentDate.getFullYear();
                              const viewingMonth = currentDate.getMonth();
                              
                              const isPastMonth = (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth));
                              const isPastDate = (viewingYear === currentYear && viewingMonth === currentMonth && day < today.getDate());
                              const canEdit = isAdmin && !isPastMonth && !isPastDate;
                              
                              if (eveningDelivery) {
                                return (
                                  <div>
                                    <div className="text-xs font-semibold text-green-600">
                                      {eveningDelivery.quantity}L {canEdit && <span className="text-gray-400">✎</span>}
                                    </div>
                                    <div className={`text-xs px-1 py-0.5 rounded text-center ${
                                      eveningDelivery.status === 'delivered' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {eveningDelivery.status}
                                    </div>
                                  </div>
                                );
                              } else if (eveningQuantity) {
                                return (
                                  <div>
                                    <div className="text-xs font-semibold text-blue-500">
                                      {eveningQuantity.quantity}L {canEdit && <span className="text-gray-400">✎</span>}
                                    </div>
                                    <div className="text-xs text-gray-500">Auto-filled</div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-xs text-gray-400">
                                    No delivery {canEdit && <span className="text-blue-500">+ Add</span>}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Daily Total */}
                    {customer && (
                      <div className="text-xs text-gray-600 text-center mt-1 pt-1 border-t border-gray-200">
                        Total: {(() => {
                          const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
                          const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
                          const morningQ = dailyQuantities[morningKey]?.quantity || deliveries[day]?.morning?.quantity || 0;
                          const eveningQ = dailyQuantities[eveningKey]?.quantity || deliveries[day]?.evening?.quantity || 0;
                          const total = morningQ + eveningQ;
                          return total > 0 ? `${total}L` : '0L';
                        })()}
                      </div>
                    )}
                    
                    {/* Click to edit hint */}
                    {customer && (
                      <div className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity text-center mt-1">
                        Click to edit
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="mt-6 grid grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-blue-600">Total Delivered</p>
          <p className="font-bold text-blue-900">
            {Object.values(deliveries)
              .filter(d => d.status === 'delivered')
              .reduce((sum, d) => sum + d.quantity, 0)
              .toFixed(1)}L
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-blue-600">Pending Deliveries</p>
          <p className="font-bold text-blue-900">
            {Object.values(deliveries)
              .filter(d => d.status === 'pending').length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-blue-600">Monthly Revenue</p>
          <p className="font-bold text-blue-900">
            ₹{(() => {
              const deliveredRevenue = Object.values(deliveries)
                .filter(d => d.status === 'delivered')
                .reduce((sum, d) => sum + (d.quantity * customer.rate_per_liter), 0);
              
              const plannedRevenue = Object.entries(dailyQuantities)
                .filter(([key]) => {
                  const [year, month] = key.split('-').map(Number);
                  return year === currentDate.getFullYear() && month === currentDate.getMonth();
                })
                .reduce((sum, [, data]) => sum + (data.quantity * customer.rate_per_liter), 0);
              
              return (deliveredRevenue + plannedRevenue).toFixed(2);
            })()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-blue-600">Completion Rate</p>
          <p className="font-bold text-blue-900">
            {Object.values(deliveries).length > 0 
              ? ((Object.values(deliveries).filter(d => d.status === 'delivered').length / Object.values(deliveries).length) * 100).toFixed(1)
              : '0'
            }%
          </p>
        </div>
      </div>
    </div>
  );
};

// Enhanced Customer Management with Calendar View
const CustomerManagementWithCalendar = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCall('/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Professional Customer Management
          </h1>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📋 List View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Calendar View
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Customer List</h2>
            <p className="text-sm text-gray-500">Click on a customer name to view monthly calendar</p>
          </div>
          
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Milk Details</th>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Quantity</th>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setViewMode('calendar');
                            }}
                            className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {customer.name}
                          </button>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{customer.address}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm">
                          <div className="text-gray-900">{customer.email}</div>
                          <div className="text-gray-500">{customer.phone}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="capitalize bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {customer.milk_type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-700 font-semibold">{customer.daily_quantity}L</td>
                      <td className="py-4 px-6 text-gray-700 font-semibold">₹{customer.rate_per_liter}</td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          customer.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setViewMode('calendar');
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          View Calendar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="space-y-6">
          {!selectedCustomer ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a Customer</h2>
              <p className="text-gray-500 mb-6">Choose a customer from the list below to view their monthly delivery calendar</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">{customer.daily_quantity}L • ₹{customer.rate_per_liter}/L</div>
                    <div className="text-sm text-gray-500 capitalize">{customer.milk_type} milk</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Customer Selection
              </button>
              <MonthlyCalendarView customer={selectedCustomer} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Milk Calendar with Customer Data
const MilkCalendarWithCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/customers`);
      setCustomers(response.data);
      setError('');
    } catch (error) {
      const errorMessage = ErrorHandler.handleApiError(error, 'Fetch Customers');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Customers</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchCustomers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <MonthlyMilkCalendar customers={customers} />
    </div>
  );
};

const MainLayout = () => {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  // Role-based navigation
  const getNavigation = useCallback(() => {
    if (user?.role === 'admin') {
      return [
        { id: 'dashboard', name: 'Dashboard', icon: '📊' },
        { id: 'customers', name: 'Customer Management', icon: '👥' },
        { id: 'calendar', name: 'Calendar View', icon: '📅' },
        { id: 'deliveries', name: 'Deliveries', icon: '🚛' },
        { id: 'payments', name: 'Payments', icon: '💳' }
      ];
    } else {
      // Customer navigation - limited access
      return [
        { id: 'dashboard', name: 'My Dashboard', icon: '📊' },
        { id: 'deliveries', name: 'My Deliveries', icon: '🚛' },
        { id: 'payments', name: 'My Payments', icon: '💳' }
      ];
    }
  }, [user?.role]);

  const navigation = getNavigation();

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'customers':
        // Only allow admin access to customer management
        if (user?.role === 'admin') {
          return <CustomerManagement />;
        } else {
          return (
            <div className="p-6 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-yellow-800 mb-2">Access Restricted</h2>
                <p className="text-yellow-700">This feature is only available to administrators.</p>
              </div>
            </div>
          );
        }
      case 'calendar':
        // Professional Calendar View with Monthly Tracking
        if (user?.role === 'admin') {
          return <CustomerManagementWithCalendar />;
        } else {
          return (
            <div className="p-6 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-yellow-800 mb-2">Access Restricted</h2>
                <p className="text-yellow-700">This feature is only available to administrators.</p>
              </div>
            </div>
          );
        }
      case 'deliveries':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {user?.role === 'admin' ? 'Delivery Management' : 'My Deliveries'}
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-700">Delivery management feature coming soon!</p>
            </div>
          </div>
        );
      case 'payments':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {user?.role === 'admin' ? 'Payment Management' : 'My Payments'}
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-700">Payment management feature coming soon!</p>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-800">🥛 PureMilk</h1>
              <span className="ml-4 text-sm text-gray-600">
                {user?.role === 'admin' ? 'Admin Panel' : 'Customer Panel'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Hello, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white shadow-lg min-h-screen">
          <nav className="mt-8">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition duration-200 ${
                  currentView === item.id ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {user ? <MainLayout /> : <LoginForm />}
    </div>
  );
}

export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}