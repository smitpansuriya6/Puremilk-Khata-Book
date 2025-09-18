import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const CustomerCalendar = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deliveries, setDeliveries] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dailyQuantities, setDailyQuantities] = useState({});
  const [editingMorning, setEditingMorning] = useState(null);
  const [editingEvening, setEditingEvening] = useState(null);
  const [editMorningQuantity, setEditMorningQuantity] = useState('');
  const [editEveningQuantity, setEditEveningQuantity] = useState('');
  const [saving, setSaving] = useState(false);

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
  const fetchProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/customer/profile`, getAuthConfig());
      setProfile(response.data);
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  }, []);

  // Fetch deliveries for the current month - ONLY for logged-in customer
  const fetchMonthlyDeliveries = useCallback(async () => {
    if (!profile || !user) return;
    
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      // Fetch deliveries specifically for THIS logged-in customer only
      const response = await axios.get(
        `${API_BASE_URL}/customer/deliveries?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&customer_id=${user.id}`,
        getAuthConfig()
      );
      
      // Convert array to object with date as key - Filter by customer ID to be extra sure
      const deliveryMap = {};
      if (response.data.deliveries) {
        response.data.deliveries
          .filter(delivery => delivery.customer_id === user.id) // Extra filter for security
          .forEach(delivery => {
            const date = new Date(delivery.delivery_date).getDate();
            if (!deliveryMap[date]) {
              deliveryMap[date] = [];
            }
            deliveryMap[date].push(delivery);
          });
      }
      
      setDeliveries(deliveryMap);
      console.log(`Loaded deliveries for customer: ${user.name} (ID: ${user.id})`); // Debug log
    } catch (error) {
      console.error('Error fetching customer deliveries:', error);
    } finally {
      setLoading(false);
    }
  }, [profile, currentDate, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      fetchMonthlyDeliveries();
    }
  }, [fetchMonthlyDeliveries]);

  // Auto-populate calendar with customer's daily quantities (like admin calendar)
  const populateDefaultQuantities = useCallback(() => {
    if (!profile) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const newQuantities = {};
    
    // Get current date to determine from which day to populate
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Check if viewing current month or future month
    const isCurrentMonth = (year === currentYear && month === currentMonth);
    const isFutureMonth = (year > currentYear || (year === currentYear && month > currentMonth));
    
    // Populate for current month (from today) or future months (full month)
    if (isCurrentMonth) {
      // For current month: populate from today onwards
      for (let day = currentDay; day <= daysInMonth; day++) {
        const morningKey = `${year}-${month}-${day}-morning`;
        const eveningKey = `${year}-${month}-${day}-evening`;
        
        // Populate morning delivery if customer has morning delivery enabled
        if (profile.morning_delivery && !deliveries[day]) {
          newQuantities[morningKey] = {
            quantity: profile.daily_quantity,
            customer: profile,
            date: `${year}-${month}-${day}`,
            time: 'morning',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
        
        // Populate evening delivery if customer has evening delivery enabled
        if (profile.evening_delivery && !deliveries[day]) {
          newQuantities[eveningKey] = {
            quantity: profile.daily_quantity,
            customer: profile,
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
        if (profile.morning_delivery && !deliveries[day]) {
          newQuantities[morningKey] = {
            quantity: profile.daily_quantity,
            customer: profile,
            date: `${year}-${month}-${day}`,
            time: 'morning',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
        
        // Populate evening delivery if customer has evening delivery enabled
        if (profile.evening_delivery && !deliveries[day]) {
          newQuantities[eveningKey] = {
            quantity: profile.daily_quantity,
            customer: profile,
            date: `${year}-${month}-${day}`,
            time: 'evening',
            isDefault: true,
            addedAt: new Date().toISOString()
          };
        }
      }
    }
    
    setDailyQuantities(newQuantities);
  }, [profile, currentDate, deliveries]);

  // Auto-populate when profile or month changes
  useEffect(() => {
    if (profile) {
      populateDefaultQuantities();
    }
  }, [populateDefaultQuantities]);

  // Check if current user is admin (for editing capability)
  const isAdmin = () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return false;
      const parsedUser = JSON.parse(userData);
      return parsedUser.role === 'admin';
    } catch {
      return false;
    }
  };

  // Handle morning delivery click for editing
  const handleMorningClick = (day) => {
    if (!profile || !day || !isAdmin()) return;
    
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
    const existingMorning = deliveries[day]?.find(d => d.delivery_time === 'morning');
    const morningQuantity = dailyQuantities[morningKey];
    
    if (existingMorning) {
      setEditMorningQuantity(existingMorning.quantity.toString());
    } else if (morningQuantity) {
      setEditMorningQuantity(morningQuantity.quantity.toString());
    } else {
      setEditMorningQuantity(profile.daily_quantity.toString());
    }
  };

  // Handle evening delivery click for editing
  const handleEveningClick = (day) => {
    if (!profile || !day || !isAdmin()) return;
    
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
    const existingEvening = deliveries[day]?.find(d => d.delivery_time === 'evening');
    const eveningQuantity = dailyQuantities[eveningKey];
    
    if (existingEvening) {
      setEditEveningQuantity(existingEvening.quantity.toString());
    } else if (eveningQuantity) {
      setEditEveningQuantity(eveningQuantity.quantity.toString());
    } else {
      setEditEveningQuantity(profile.daily_quantity.toString());
    }
  };

  // Handle morning delivery save
  const handleMorningSave = async (day) => {
    if (!profile || !editMorningQuantity || !isAdmin()) return;
    
    const numericValue = parseFloat(editMorningQuantity);
    if (isNaN(numericValue) || numericValue <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    setSaving(true);
    const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
    const existingMorning = deliveries[day]?.find(d => d.delivery_time === 'morning');
    
    try {
      if (existingMorning) {
        // Update existing delivery via API
        const response = await axios.put(
          `${API_BASE_URL}/deliveries/${existingMorning.id}`, 
          { quantity: numericValue },
          getAuthConfig()
        );
        console.log('Morning delivery updated:', response.data);
      } else {
        // Create new delivery via API
        const deliveryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const response = await axios.post(
          `${API_BASE_URL}/deliveries`,
          {
            customer_id: user.id,
            delivery_date: deliveryDate.toISOString().split('T')[0],
            delivery_time: 'morning',
            quantity: numericValue,
            status: 'pending'
          },
          getAuthConfig()
        );
        console.log('Morning delivery created:', response.data);
      }
      
      // Update local state for immediate UI update
      setDailyQuantities(prev => ({
        ...prev,
        [morningKey]: {
          quantity: numericValue,
          customer: profile,
          date: `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`,
          time: 'morning',
          isDefault: false,
          addedAt: new Date().toISOString()
        }
      }));
      
      setEditingMorning(null);
      setEditMorningQuantity('');
      
      // Refresh deliveries to get latest data
      await fetchMonthlyDeliveries();
      
    } catch (error) {
      console.error('Error saving morning delivery:', error);
      alert('Error saving morning delivery: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Handle evening delivery save
  const handleEveningSave = async (day) => {
    if (!profile || !editEveningQuantity || !isAdmin()) return;
    
    const numericValue = parseFloat(editEveningQuantity);
    if (isNaN(numericValue) || numericValue <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    setSaving(true);
    const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
    const existingEvening = deliveries[day]?.find(d => d.delivery_time === 'evening');
    
    try {
      if (existingEvening) {
        // Update existing delivery via API
        const response = await axios.put(
          `${API_BASE_URL}/deliveries/${existingEvening.id}`, 
          { quantity: numericValue },
          getAuthConfig()
        );
        console.log('Evening delivery updated:', response.data);
      } else {
        // Create new delivery via API
        const deliveryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const response = await axios.post(
          `${API_BASE_URL}/deliveries`,
          {
            customer_id: user.id,
            delivery_date: deliveryDate.toISOString().split('T')[0],
            delivery_time: 'evening',
            quantity: numericValue,
            status: 'pending'
          },
          getAuthConfig()
        );
        console.log('Evening delivery created:', response.data);
      }
      
      // Update local state for immediate UI update
      setDailyQuantities(prev => ({
        ...prev,
        [eveningKey]: {
          quantity: numericValue,
          customer: profile,
          date: `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`,
          time: 'evening',
          isDefault: false,
          addedAt: new Date().toISOString()
        }
      }));
      
      setEditingEvening(null);
      setEditEveningQuantity('');
      
      // Refresh deliveries to get latest data
      await fetchMonthlyDeliveries();
      
    } catch (error) {
      console.error('Error saving evening delivery:', error);
      alert('Error saving evening delivery: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Helper function to get days in month with proper grid layout
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

  // Calculate monthly totals - Include both delivered and planned quantities
  const calculateMonthlyTotals = () => {
    let totalDelivered = 0;
    let totalPlanned = 0;
    let deliveredAmount = 0;
    let plannedAmount = 0;
    let deliveredDays = 0;
    let plannedDays = 0;

    // Calculate delivered quantities
    Object.values(deliveries).forEach(dayDeliveries => {
      dayDeliveries
        .filter(delivery => delivery.customer_id === user?.id) // Ensure only this customer's data
        .forEach(delivery => {
          if (delivery.status === 'delivered') {
            totalDelivered += delivery.quantity || 0;
            deliveredAmount += (delivery.quantity || 0) * (profile?.rate_per_liter || 0);
            deliveredDays++;
          }
        });
    });

    // Calculate planned/auto-filled quantities
    Object.entries(dailyQuantities).forEach(([key, data]) => {
      if (data.isDefault) {
        totalPlanned += data.quantity || 0;
        plannedAmount += (data.quantity || 0) * (profile?.rate_per_liter || 0);
        plannedDays++;
      }
    });

    return { 
      totalDelivered, 
      totalPlanned,
      totalQuantity: totalDelivered + totalPlanned,
      deliveredAmount, 
      plannedAmount,
      totalAmount: deliveredAmount + plannedAmount,
      deliveredDays,
      plannedDays,
      totalDays: deliveredDays + plannedDays
    };
  };

  const monthlyTotals = calculateMonthlyTotals();

  // Security check - ensure user exists and matches profile
  if (!user || !user.id) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-700">Unable to verify user identity. Please log in again.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Delivery Calendar</h2>
          <p className="text-sm text-gray-500">Track your monthly milk deliveries - {user?.name}</p>
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

      {/* Customer Identification Banner */}
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            Personal Calendar
          </div>
          <p className="text-green-800 font-medium">
            📅 Showing deliveries for: <strong>{user.name}</strong> ({user.email})
          </p>
        </div>
      </div>

      {/* Customer Info Summary */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-blue-600">Daily Quantity</p>
            <p className="font-bold text-blue-900">{profile.daily_quantity}L</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600">Rate per Liter</p>
            <p className="font-bold text-blue-900">₹{profile.rate_per_liter}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600">Milk Type</p>
            <p className="font-bold text-blue-900 capitalize">{profile.milk_type}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-600">Delivery Times</p>
            <p className="font-bold text-blue-900">
              {profile.morning_delivery ? '🌅 ' : ''}
              {profile.evening_delivery ? '🌙' : ''}
              {!profile.morning_delivery && !profile.evening_delivery ? 'Not set' : ''}
            </p>
          </div>
        </div>
      </div>

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
                day === null ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              {day && (
                <div className="h-full flex flex-col">
                  {/* Day number */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-900">{day}</span>
                    {new Date().getDate() === day && 
                     new Date().getMonth() === currentDate.getMonth() && 
                     new Date().getFullYear() === currentDate.getFullYear() && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">Today</span>
                    )}
                  </div>

                  {/* Delivery info - Similar to admin calendar */}
                  <div className="flex-1 space-y-1">
                    {/* Morning Delivery */}
                    {profile && profile.morning_delivery && (
                      <div className="bg-orange-50 border border-orange-200 rounded p-1">
                        <div className="text-xs font-semibold text-orange-700 mb-1">🌅 Morning</div>
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
                              className="w-full p-1 text-xs border border-orange-300 rounded"
                              placeholder="Morning qty"
                              autoFocus
                              disabled={saving}
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => handleMorningSave(day)}
                                disabled={saving}
                                className="flex-1 px-1 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMorning(null);
                                  setEditMorningQuantity('');
                                }}
                                disabled={saving}
                                className="flex-1 px-1 py-0.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => isAdmin() && handleMorningClick(day)} className={isAdmin() ? 'cursor-pointer hover:bg-orange-100' : ''}>
                            {(() => {
                              const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
                              const morningQuantity = dailyQuantities[morningKey];
                              const morningDelivery = deliveries[day]?.find(d => d.delivery_time === 'morning');
                              
                              // Check if this is a past month or past date in current month
                              const today = new Date();
                              const currentMonth = today.getMonth();
                              const currentYear = today.getFullYear();
                              const viewingYear = currentDate.getFullYear();
                              const viewingMonth = currentDate.getMonth();
                              
                              const isPastMonth = (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth));
                              const isPastDate = (viewingYear === currentYear && viewingMonth === currentMonth && day < today.getDate());
                              const canEdit = isAdmin() && !isPastMonth && !isPastDate;
                              
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
                                    No delivery {canEdit && <span className="text-blue-500 cursor-pointer">+ Add</span>}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Evening Delivery */}
                    {profile && profile.evening_delivery && (
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
                              className="w-full p-1 text-xs border border-blue-300 rounded"
                              placeholder="Evening qty"
                              autoFocus
                              disabled={saving}
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => handleEveningSave(day)}
                                disabled={saving}
                                className="flex-1 px-1 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingEvening(null);
                                  setEditEveningQuantity('');
                                }}
                                disabled={saving}
                                className="flex-1 px-1 py-0.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => isAdmin() && handleEveningClick(day)} className={isAdmin() ? 'cursor-pointer hover:bg-blue-100' : ''}>
                            {(() => {
                              const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
                              const eveningQuantity = dailyQuantities[eveningKey];
                              const eveningDelivery = deliveries[day]?.find(d => d.delivery_time === 'evening');
                              
                              // Check if this is a past month or past date in current month
                              const today = new Date();
                              const currentMonth = today.getMonth();
                              const currentYear = today.getFullYear();
                              const viewingYear = currentDate.getFullYear();
                              const viewingMonth = currentDate.getMonth();
                              
                              const isPastMonth = (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth));
                              const isPastDate = (viewingYear === currentYear && viewingMonth === currentMonth && day < today.getDate());
                              const canEdit = isAdmin() && !isPastMonth && !isPastDate;
                              
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
                                    No delivery {canEdit && <span className="text-blue-500 cursor-pointer">+ Add</span>}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Daily Total */}
                    {profile && (
                      <div className="text-xs text-gray-600 text-center mt-1 pt-1 border-t border-gray-200">
                        Total: {(() => {
                          const morningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-morning`;
                          const eveningKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-evening`;
                          const morningQ = dailyQuantities[morningKey]?.quantity || 
                                         deliveries[day]?.find(d => d.delivery_time === 'morning')?.quantity || 0;
                          const eveningQ = dailyQuantities[eveningKey]?.quantity || 
                                         deliveries[day]?.find(d => d.delivery_time === 'evening')?.quantity || 0;
                          const total = morningQ + eveningQ;
                          return total > 0 ? `${total}L` : '0L';
                        })()}
                      </div>
                    )}
                    
                    {/* No delivery message for days without morning/evening delivery */}
                    {(!profile?.morning_delivery && !profile?.evening_delivery) && (
                      <div className="text-xs text-gray-400 text-center py-2">
                        No delivery
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
      <div className="mt-6 space-y-4">
        {/* Delivered vs Planned Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Delivered</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-green-600">Quantity</p>
                <p className="font-bold text-green-900 text-xl">{monthlyTotals.totalDelivered.toFixed(1)}L</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-green-600">Amount</p>
                <p className="font-bold text-green-900 text-xl">₹{monthlyTotals.deliveredAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">📅 Planned</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-blue-600">Quantity</p>
                <p className="font-bold text-blue-900 text-xl">{monthlyTotals.totalPlanned.toFixed(1)}L</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-blue-600">Expected</p>
                <p className="font-bold text-blue-900 text-xl">₹{monthlyTotals.plannedAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-800 mb-2">📊 Monthly Total</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-purple-600">Total Quantity</p>
              <p className="font-bold text-purple-900 text-2xl">{monthlyTotals.totalQuantity.toFixed(1)}L</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-purple-600">Total Days</p>
              <p className="font-bold text-purple-900 text-2xl">{monthlyTotals.totalDays}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-purple-600">Total Amount</p>
              <p className="font-bold text-purple-900 text-2xl">₹{monthlyTotals.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Information Note */}
      <div className="mt-4 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Calendar Legend:</strong> 
                🌅 Morning delivery • 🌙 Evening delivery • 
                <span className="bg-green-100 text-green-800 px-1 rounded">Green</span> = Delivered • 
                <span className="bg-yellow-100 text-yellow-800 px-1 rounded">Yellow</span> = Pending • 
                <span className="bg-blue-100 text-blue-800 px-1 rounded">Blue</span> = Auto-filled (Planned)
              </p>
            </div>
          </div>
        </div>

        {/* Customer vs Admin Access Info */}
        <div className={`border rounded-lg p-4 ${
          isAdmin() ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-xl">{isAdmin() ? '👨‍💼' : '👤'}</span>
            </div>
            <div className="ml-3">
              <p className={`text-sm ${isAdmin() ? 'text-orange-700' : 'text-gray-700'}`}>
                {isAdmin() ? (
                  <>
                    <strong>Admin Access:</strong> Click on any delivery entry to edit quantities. Changes are saved automatically to the database. 
                    Press Enter to save, Escape to cancel. {saving && <span className="text-orange-600 font-semibold">Saving...</span>}
                  </>
                ) : (
                  <>
                    <strong>Customer View:</strong> This is your personal delivery calendar. You can view your scheduled and 
                    delivered milk quantities. Contact your admin for any changes or updates needed.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default CustomerCalendar;