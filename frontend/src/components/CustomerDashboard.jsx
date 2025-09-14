import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CustomerDashboard = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  const API_BASE_URL = 'http://localhost:8001/api';

  // Get stored token
  const getToken = () => localStorage.getItem('token');

  // Axios config with auth header
  const getAuthConfig = () => ({
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });

  // Fetch customer profile
  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/customer/profile`, getAuthConfig());
      setProfile(response.data);
    } catch (error) {
      console.error('Profile fetch error:', error);
      if (error.response?.status === 401) {
        onLogout(); // Token expired or invalid
      }
    }
  };

  // Fetch deliveries
  const fetchDeliveries = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/customer/deliveries?limit=50`, getAuthConfig());
      setDeliveries(response.data.deliveries || []);
    } catch (error) {
      console.error('Deliveries fetch error:', error);
    }
  };

  // Fetch payments
  const fetchPayments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/customer/payments?limit=50`, getAuthConfig());
      setPayments(response.data.payments || []);
    } catch (error) {
      console.error('Payments fetch error:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchDeliveries(), fetchPayments()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Calculate monthly stats
  const calculateStats = () => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const monthlyDeliveries = deliveries.filter(d => {
      const deliveryDate = new Date(d.delivery_date);
      return deliveryDate.getMonth() === currentMonth && deliveryDate.getFullYear() === currentYear;
    });
    
    const monthlyPayments = payments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
    });
    
    const totalQuantity = monthlyDeliveries.reduce((sum, d) => sum + d.quantity, 0);
    const totalAmount = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = monthlyPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    
    return {
      totalQuantity,
      totalAmount,
      pendingAmount,
      deliveryCount: monthlyDeliveries.length
    };
  };

  const stats = profile ? calculateStats() : { totalQuantity: 0, totalAmount: 0, pendingAmount: 0, deliveryCount: 0 };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🥛</span>
              <h1 className="text-2xl font-bold text-gray-900">PureMilk Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user.name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Profile Card */}
          {profile && (
            <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Your Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{profile.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Daily Quantity</p>
                    <p className="font-medium">{profile.daily_quantity}L</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rate per Liter</p>
                    <p className="font-medium">₹{profile.rate_per_liter}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Milk Type</p>
                    <p className="font-medium capitalize">{profile.milk_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">{profile.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Morning Delivery</p>
                    <p className="font-medium">{profile.morning_delivery ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Evening Delivery</p>
                    <p className="font-medium">{profile.evening_delivery ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">📦</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">This Month Deliveries</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.deliveryCount}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">🥛</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Quantity</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalQuantity.toFixed(1)}L</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Payments</dt>
                      <dd className="text-lg font-medium text-green-600">₹{stats.totalAmount.toFixed(2)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending Amount</dt>
                      <dd className="text-lg font-medium text-red-600">₹{stats.pendingAmount.toFixed(2)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Deliveries and Payments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Recent Deliveries */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Deliveries</h3>
                <div className="flow-root">
                  <ul className="-my-5 divide-y divide-gray-200">
                    {deliveries.slice(0, 5).map((delivery) => (
                      <li key={delivery.id} className="py-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              delivery.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {delivery.status}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {delivery.quantity}L - {delivery.milk_type}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(delivery.delivery_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                    {deliveries.length === 0 && (
                      <li className="py-4 text-gray-500 text-center">No deliveries found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Payments</h3>
                <div className="flow-root">
                  <ul className="-my-5 divide-y divide-gray-200">
                    {payments.slice(0, 5).map((payment) => (
                      <li key={payment.id} className="py-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                              payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {payment.status}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              ₹{payment.amount} - {payment.method || 'Cash'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                    {payments.length === 0 && (
                      <li className="py-4 text-gray-500 text-center">No payments found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Read-only Notice */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> This is a read-only dashboard. You can view your delivery and payment history, but cannot make changes. 
                  Contact your admin for any updates or modifications needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboard;