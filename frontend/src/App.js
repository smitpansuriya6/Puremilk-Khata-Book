import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from "react";
import "./App.css";
import axios from "axios";
import config from "./config/config";
import ErrorHandler from "./utils/errorHandler";

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

const MainLayout = () => {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  // Role-based navigation
  const getNavigation = useCallback(() => {
    if (user?.role === 'admin') {
      return [
        { id: 'dashboard', name: 'Dashboard', icon: '📊' },
        { id: 'customers', name: 'Customers', icon: '👥' },
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