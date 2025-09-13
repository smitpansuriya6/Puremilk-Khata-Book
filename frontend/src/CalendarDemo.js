import React from 'react';
import MonthlyMilkCalendar from './components/MonthlyMilkCalendar';
import './App.css';

// Sample customers data for demo
const sampleCustomers = [
  {
    id: 1,
    name: 'Rajesh Sharma',
    daily_quantity: 2.0,
    rate_per_liter: 60,
    milk_type: 'cow',
    phone: '9876543210'
  },
  {
    id: 2,
    name: 'Priya Patel',
    daily_quantity: 1.5,
    rate_per_liter: 65,
    milk_type: 'buffalo',
    phone: '9876543211'
  },
  {
    id: 3,
    name: 'Amit Kumar',
    daily_quantity: 3.0,
    rate_per_liter: 58,
    milk_type: 'cow',
    phone: '9876543212'
  },
  {
    id: 4,
    name: 'Sunita Devi',
    daily_quantity: 1.0,
    rate_per_liter: 70,
    milk_type: 'buffalo',
    phone: '9876543213'
  }
];

// Simple demo app to showcase the Monthly Milk Calendar
function CalendarDemo() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Smart Milk Calendar - Auto-Populate & Edit
        </h1>
        <MonthlyMilkCalendar customers={sampleCustomers} />
        
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Smart Features:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-green-700 mb-2">🚀 Auto-Population</h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Select customer → Calendar auto-fills with daily quantity</li>
                  <li>• Blue values = Default (auto-filled)</li>
                  <li>• Green values = User edited</li>
                  <li>• Shows customer name & revenue per cell</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-blue-700 mb-2">✏️ Easy Editing</h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Click any date to edit quantity</li>
                  <li>• Enter to save, Escape to cancel</li>
                  <li>• Clear button to reset entire calendar</li>
                  <li>• Monthly statistics with revenue calculation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarDemo;