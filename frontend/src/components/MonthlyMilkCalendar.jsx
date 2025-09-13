import React, { useState, useCallback, useEffect } from 'react';

const MonthlyMilkCalendar = ({ customers = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyQuantities, setDailyQuantities] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [defaultQuantity, setDefaultQuantity] = useState(1.0);

  // Auto-populate calendar when customer is selected
  const populateDefaultQuantities = useCallback(() => {
    if (!selectedCustomer) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const newQuantities = { ...dailyQuantities };
    
    // Add default quantities for all days if not already present
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${month}-${day}`;
      if (!newQuantities[dateKey]) {
        newQuantities[dateKey] = {
          quantity: selectedCustomer.daily_quantity,
          customer: selectedCustomer,
          date: dateKey,
          addedAt: new Date().toISOString(),
          isDefault: true // Mark as default entry
        };
      }
    }
    
    setDailyQuantities(newQuantities);
  }, [selectedCustomer, currentDate, dailyQuantities]);

  // Auto-populate when month changes
  useEffect(() => {
    if (selectedCustomer) {
      populateDefaultQuantities();
    }
  }, [currentDate, selectedCustomer]);

  // Helper function to get days in month with proper grid layout
  const getDaysInMonth = useCallback((date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
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

  // Generate a unique key for each date
  const getDateKey = (day) => {
    if (!day) return null;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return `${year}-${month}-${day}`;
  };

  // Handle cell click to start editing
  const handleCellClick = (day) => {
    if (!day) return;
    
    const dateKey = getDateKey(day);
    setEditingCell(dateKey);
    // Use existing value or default quantity from selected customer
    const existingValue = dailyQuantities[dateKey];
    const defaultValue = selectedCustomer?.daily_quantity || defaultQuantity;
    setEditValue(existingValue || defaultValue.toString());
  };

  // Save the edited value
  const saveValue = () => {
    if (editingCell && editValue.trim() !== '') {
      const numericValue = parseFloat(editValue);
      if (!isNaN(numericValue) && numericValue > 0) {
        setDailyQuantities(prev => ({
          ...prev,
          [editingCell]: {
            quantity: numericValue,
            customer: selectedCustomer,
            date: editingCell,
            addedAt: new Date().toISOString(),
            isDefault: false // Mark as user-edited
          }
        }));
      }
    }
    setEditingCell(null);
    setEditValue('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press in input field
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveValue();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Handle input blur
  const handleBlur = () => {
    saveValue();
  };

  // Navigate between months
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getDaysInMonth(currentDate);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Monthly Milk Delivery Calendar</h2>
        
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

      {/* Customer Selection and Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Customer
          </label>
          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const customer = customers.find(c => c.id === parseInt(e.target.value));
              setSelectedCustomer(customer);
              if (customer) {
                setDefaultQuantity(customer.daily_quantity || 1.0);
                // Auto-populate calendar with customer's daily quantity
                setTimeout(() => populateDefaultQuantities(), 100);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a customer...</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} - {customer.daily_quantity}L/day
              </option>
            ))}
          </select>
        </div>
        
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Daily Quantity (Liters)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={defaultQuantity}
              onChange={(e) => setDefaultQuantity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter default quantity"
            />
          </div>


        </div>
      </div>

      {/* Customer Info Display */}
      {!selectedCustomer ? (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-center">
            <div className="text-yellow-800 text-lg font-medium mb-2">
              👆 Please select a customer above to view their milk delivery calendar
            </div>
            <p className="text-yellow-700 text-sm">
              The calendar will automatically populate with their daily milk quantity which you can then edit as needed.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Selected Customer: {selectedCustomer.name}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Daily Quantity:</span>
              <span className="font-medium text-blue-900 ml-1">{selectedCustomer.daily_quantity}L</span>
            </div>
            <div>
              <span className="text-blue-600">Rate:</span>
              <span className="font-medium text-blue-900 ml-1">₹{selectedCustomer.rate_per_liter}/L</span>
            </div>
            <div>
              <span className="text-blue-600">Milk Type:</span>
              <span className="font-medium text-blue-900 ml-1 capitalize">{selectedCustomer.milk_type}</span>
            </div>
            <div>
              <span className="text-blue-600">Phone:</span>
              <span className="font-medium text-blue-900 ml-1">{selectedCustomer.phone}</span>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-gray-100">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
                  {days.map((day, index) => {
                    const dateKey = getDateKey(day);
                    const isEditing = editingCell === dateKey;
                    const deliveryData = dailyQuantities[dateKey];
                    const quantity = deliveryData?.quantity;
                    const isEmptyCell = day === null;            return (
              <div
                key={index}
                className={`min-h-[80px] border-b border-r border-gray-200 last:border-r-0 calendar-cell ${
                  isEmptyCell 
                    ? 'bg-gray-50' 
                    : 'bg-white hover:bg-gray-50 cursor-pointer'
                }`}
                onClick={() => !isEmptyCell && !isEditing && handleCellClick(day)}
              >
                {!isEmptyCell && (
                  <div className="h-full p-2 flex flex-col">
                    {/* Day number */}
                    <div className="text-sm font-medium text-gray-900 mb-2">
                      {day}
                    </div>

                    {/* Milk quantity display or input */}
                    <div className="flex-1 flex items-center justify-center">
                      {isEditing ? (
                        <div className="w-full">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            onBlur={handleBlur}
                            placeholder="0.0"
                            className="w-full p-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center calendar-input"
                            autoFocus
                          />
                          <div className="text-xs text-gray-500 text-center mt-1">
                            Press Enter to save
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          {deliveryData ? (
                            <div>
                              <div className={`text-lg font-bold ${
                                deliveryData.isDefault ? 'text-blue-500' : 'text-green-600'
                              }`}>
                                {quantity}L
                              </div>
                              {deliveryData.customer && (
                                <div className="text-xs text-blue-600 truncate">
                                  {deliveryData.customer.name}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {deliveryData.isDefault ? 'Default • Click to edit' : 'Click to edit'}
                              </div>
                              {selectedCustomer && deliveryData.customer && (
                                <div className="text-xs text-green-600">
                                  ₹{(quantity * selectedCustomer.rate_per_liter).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm text-gray-400">
                                No delivery
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Click to add
                              </div>
                              {selectedCustomer && (
                                <div className="text-xs text-blue-500">
                                  Default: {defaultQuantity}L
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="mt-6 grid grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-green-600">Total Days with Delivery</p>
          <p className="font-bold text-green-900">
            {Object.keys(dailyQuantities).filter(key => {
              const [year, month] = key.split('-').map(Number);
              return year === currentDate.getFullYear() && month === currentDate.getMonth();
            }).length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-green-600">Total Monthly Quantity</p>
          <p className="font-bold text-green-900">
            {Object.entries(dailyQuantities)
              .filter(([key]) => {
                const [year, month] = key.split('-').map(Number);
                return year === currentDate.getFullYear() && month === currentDate.getMonth();
              })
              .reduce((sum, [, deliveryData]) => sum + (deliveryData?.quantity || 0), 0)
              .toFixed(1)}L
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-green-600">Average Daily Quantity</p>
          <p className="font-bold text-green-900">
            {(() => {
              const currentMonthEntries = Object.entries(dailyQuantities)
                .filter(([key]) => {
                  const [year, month] = key.split('-').map(Number);
                  return year === currentDate.getFullYear() && month === currentDate.getMonth();
                });
              const total = currentMonthEntries.reduce((sum, [, deliveryData]) => sum + (deliveryData?.quantity || 0), 0);
              const count = currentMonthEntries.length;
              return count > 0 ? (total / count).toFixed(1) : '0.0';
            })()}L
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-green-600">Monthly Revenue</p>
          <p className="font-bold text-green-900">
            {selectedCustomer ? (
              '₹' + Object.entries(dailyQuantities)
                .filter(([key]) => {
                  const [year, month] = key.split('-').map(Number);
                  return year === currentDate.getFullYear() && month === currentDate.getMonth();
                })
                .reduce((sum, [, deliveryData]) => {
                  return sum + ((deliveryData?.quantity || 0) * selectedCustomer.rate_per_liter);
                }, 0)
                .toFixed(2)
            ) : '₹0.00'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MonthlyMilkCalendar;