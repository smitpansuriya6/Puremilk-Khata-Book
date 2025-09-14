import React, { useState, useEffect } from 'react';
import CustomerLogin from './components/CustomerLogin.jsx';
import CustomerDashboard from './components/CustomerDashboard.jsx';
import AdminRegistration from './components/AdminRegistration.jsx';
import { App } from './App.js';
import axios from 'axios';

const MainApp = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const API_BASE_URL = 'http://localhost:8001/api';

  // Check if admin exists
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/auth/check-admin`);
        setAdminExists(response.data.admin_exists);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setAdminExists(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleRegistrationSuccess = (userData) => {
    setUser(userData);
    setAdminExists(true);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    // If no admin exists, show admin registration
    if (!adminExists) {
      return <AdminRegistration onRegistrationSuccess={handleRegistrationSuccess} />;
    }
    // Admin exists, show customer login
    return <CustomerLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // Admin user - show full admin app
  if (user.role === 'admin') {
    return <App user={user} onLogout={handleLogout} />;
  }

  // Customer user - show customer dashboard
  if (user.role === 'customer') {
    return <CustomerDashboard user={user} onLogout={handleLogout} />;
  }

  // Invalid role
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">Invalid user role</p>
        <button
          onClick={handleLogout}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default MainApp;