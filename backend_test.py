#!/usr/bin/env python3
"""
Backend API Testing for PureMilk Dairy Management System
Tests authentication, customer management, dashboard stats, deliveries, and payments
"""

import requests
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Load environment variables
BACKEND_URL = " http://0.0.0.0:8001/api"

class PureMilkAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.admin_token = None
        self.customer_token = None
        self.admin_user_id = None
        self.customer_user_id = None
        self.test_customer_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None) -> Dict:
        """Make HTTP request with optional authentication"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": response.status_code < 400
            }
        except requests.exceptions.RequestException as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)},
                "success": False
            }
        except json.JSONDecodeError:
            return {
                "status_code": response.status_code,
                "data": {"error": "Invalid JSON response"},
                "success": False
            }
    
    def test_user_registration(self):
        """Test user registration for both admin and customer roles"""
        print("\n=== Testing User Registration ===")
        
        # Test admin registration
        admin_data = {
            "email": "admin@puremilk.com",
            "password": "AdminPass123!",
            "role": "admin",
            "name": "Admin User",
            "phone": "+1234567890"
        }
        
        response = self.make_request("POST", "/auth/register", admin_data)
        if response["success"] and "token" in response["data"]:
            self.admin_token = response["data"]["token"]
            self.admin_user_id = response["data"]["user"]["id"]
            self.log_test("Admin Registration", True, "Admin user registered successfully")
        else:
            self.log_test("Admin Registration", False, "Failed to register admin user", response["data"])
        
        # Test customer registration
        customer_data = {
            "email": "customer@puremilk.com",
            "password": "CustomerPass123!",
            "role": "customer",
            "name": "Customer User",
            "phone": "+1234567891"
        }
        
        response = self.make_request("POST", "/auth/register", customer_data)
        if response["success"] and "token" in response["data"]:
            self.customer_token = response["data"]["token"]
            self.customer_user_id = response["data"]["user"]["id"]
            self.log_test("Customer Registration", True, "Customer user registered successfully")
        else:
            self.log_test("Customer Registration", False, "Failed to register customer user", response["data"])
        
        # Test duplicate registration
        response = self.make_request("POST", "/auth/register", admin_data)
        if response["status_code"] == 400:
            self.log_test("Duplicate Registration Prevention", True, "Correctly prevented duplicate registration")
        else:
            self.log_test("Duplicate Registration Prevention", False, "Should prevent duplicate registration", response["data"])
    
    def test_user_login(self):
        """Test user login functionality"""
        print("\n=== Testing User Login ===")
        
        # Test admin login
        admin_login = {
            "email": "admin@puremilk.com",
            "password": "AdminPass123!"
        }
        
        response = self.make_request("POST", "/auth/login", admin_login)
        if response["success"] and "token" in response["data"]:
            # Update token in case it's different
            self.admin_token = response["data"]["token"]
            self.log_test("Admin Login", True, "Admin login successful")
        else:
            self.log_test("Admin Login", False, "Admin login failed", response["data"])
        
        # Test customer login
        customer_login = {
            "email": "customer@puremilk.com",
            "password": "CustomerPass123!"
        }
        
        response = self.make_request("POST", "/auth/login", customer_login)
        if response["success"] and "token" in response["data"]:
            self.customer_token = response["data"]["token"]
            self.log_test("Customer Login", True, "Customer login successful")
        else:
            self.log_test("Customer Login", False, "Customer login failed", response["data"])
        
        # Test invalid credentials
        invalid_login = {
            "email": "admin@puremilk.com",
            "password": "WrongPassword"
        }
        
        response = self.make_request("POST", "/auth/login", invalid_login)
        if response["status_code"] == 401:
            self.log_test("Invalid Credentials", True, "Correctly rejected invalid credentials")
        else:
            self.log_test("Invalid Credentials", False, "Should reject invalid credentials", response["data"])
    
    def test_jwt_token_validation(self):
        """Test JWT token validation"""
        print("\n=== Testing JWT Token Validation ===")
        
        # Test valid token
        if self.admin_token:
            response = self.make_request("GET", "/auth/me", token=self.admin_token)
            if response["success"] and response["data"].get("role") == "admin":
                self.log_test("Valid Token Validation", True, "Valid admin token accepted")
            else:
                self.log_test("Valid Token Validation", False, "Valid token rejected", response["data"])
        
        # Test invalid token
        response = self.make_request("GET", "/auth/me", token="invalid_token_123")
        if response["status_code"] == 401:
            self.log_test("Invalid Token Rejection", True, "Invalid token correctly rejected")
        else:
            self.log_test("Invalid Token Rejection", False, "Should reject invalid token", response["data"])
        
        # Test no token
        response = self.make_request("GET", "/auth/me")
        if response["status_code"] == 403:
            self.log_test("No Token Rejection", True, "Request without token correctly rejected")
        else:
            self.log_test("No Token Rejection", False, "Should reject request without token", response["data"])
    
    def test_customer_management_crud(self):
        """Test customer CRUD operations"""
        print("\n=== Testing Customer Management CRUD ===")
        
        if not self.admin_token:
            self.log_test("Customer CRUD Setup", False, "No admin token available for testing")
            return
        
        # Test create customer (admin only)
        customer_data = {
            "name": "John Doe",
            "email": "john.doe@example.com",
            "phone": "+1234567892",
            "address": "123 Main St, City, State",
            "milk_type": "cow",
            "daily_quantity": 2.5,
            "rate_per_liter": 45.0,
            "morning_delivery": True,
            "evening_delivery": False
        }
        
        response = self.make_request("POST", "/customers", customer_data, self.admin_token)
        if response["success"] and "id" in response["data"]:
            self.test_customer_id = response["data"]["id"]
            self.log_test("Create Customer (Admin)", True, "Customer created successfully")
        else:
            self.log_test("Create Customer (Admin)", False, "Failed to create customer", response["data"])
        
        # Test create customer with customer token (should fail)
        if self.customer_token:
            response = self.make_request("POST", "/customers", customer_data, self.customer_token)
            if response["status_code"] == 403:
                self.log_test("Create Customer (Customer Role)", True, "Customer role correctly denied access")
            else:
                self.log_test("Create Customer (Customer Role)", False, "Should deny customer role access", response["data"])
        
        # Test get all customers (admin only)
        response = self.make_request("GET", "/customers", token=self.admin_token)
        if response["success"] and isinstance(response["data"], list):
            self.log_test("Get All Customers (Admin)", True, f"Retrieved {len(response['data'])} customers")
        else:
            self.log_test("Get All Customers (Admin)", False, "Failed to get customers", response["data"])
        
        # Test get customers with customer token (should fail)
        if self.customer_token:
            response = self.make_request("GET", "/customers", token=self.customer_token)
            if response["status_code"] == 403:
                self.log_test("Get Customers (Customer Role)", True, "Customer role correctly denied access")
            else:
                self.log_test("Get Customers (Customer Role)", False, "Should deny customer role access", response["data"])
        
        # Test get specific customer
        if self.test_customer_id:
            response = self.make_request("GET", f"/customers/{self.test_customer_id}", token=self.admin_token)
            if response["success"] and response["data"].get("id") == self.test_customer_id:
                self.log_test("Get Specific Customer", True, "Retrieved specific customer successfully")
            else:
                self.log_test("Get Specific Customer", False, "Failed to get specific customer", response["data"])
        
        # Test update customer
        if self.test_customer_id:
            update_data = {
                "daily_quantity": 3.0,
                "rate_per_liter": 50.0
            }
            response = self.make_request("PUT", f"/customers/{self.test_customer_id}", update_data, self.admin_token)
            if response["success"] and response["data"].get("daily_quantity") == 3.0:
                self.log_test("Update Customer", True, "Customer updated successfully")
            else:
                self.log_test("Update Customer", False, "Failed to update customer", response["data"])
        
        # Test delete customer
        if self.test_customer_id:
            response = self.make_request("DELETE", f"/customers/{self.test_customer_id}", token=self.admin_token)
            if response["success"]:
                self.log_test("Delete Customer", True, "Customer deleted successfully")
            else:
                self.log_test("Delete Customer", False, "Failed to delete customer", response["data"])
    
    def test_dashboard_stats(self):
        """Test dashboard statistics API"""
        print("\n=== Testing Dashboard Stats API ===")
        
        if not self.admin_token:
            self.log_test("Dashboard Stats Setup", False, "No admin token available for testing")
            return
        
        # Test dashboard stats with admin token
        response = self.make_request("GET", "/dashboard/stats", token=self.admin_token)
        if response["success"]:
            stats = response["data"]
            required_fields = ["total_customers", "active_customers", "today_deliveries", 
                             "pending_deliveries", "today_revenue", "monthly_revenue", "pending_payments"]
            
            if all(field in stats for field in required_fields):
                self.log_test("Dashboard Stats (Admin)", True, "Dashboard stats retrieved successfully")
            else:
                missing_fields = [field for field in required_fields if field not in stats]
                self.log_test("Dashboard Stats (Admin)", False, f"Missing fields: {missing_fields}", stats)
        else:
            self.log_test("Dashboard Stats (Admin)", False, "Failed to get dashboard stats", response["data"])
        
        # Test dashboard stats with customer token (should fail)
        if self.customer_token:
            response = self.make_request("GET", "/dashboard/stats", token=self.customer_token)
            if response["status_code"] == 403:
                self.log_test("Dashboard Stats (Customer Role)", True, "Customer role correctly denied access")
            else:
                self.log_test("Dashboard Stats (Customer Role)", False, "Should deny customer role access", response["data"])
    
    def test_delivery_management(self):
        """Test delivery management endpoints"""
        print("\n=== Testing Delivery Management ===")
        
        # Test get deliveries with admin token
        if self.admin_token:
            response = self.make_request("GET", "/deliveries", token=self.admin_token)
            if response["success"]:
                self.log_test("Get Deliveries (Admin)", True, f"Retrieved {len(response['data'])} deliveries")
            else:
                self.log_test("Get Deliveries (Admin)", False, "Failed to get deliveries", response["data"])
        
        # Test get deliveries with customer token
        if self.customer_token:
            response = self.make_request("GET", "/deliveries", token=self.customer_token)
            if response["success"]:
                self.log_test("Get Deliveries (Customer)", True, f"Customer can view deliveries: {len(response['data'])} deliveries")
            else:
                self.log_test("Get Deliveries (Customer)", False, "Customer failed to get deliveries", response["data"])
        
        # Test get deliveries without token (should fail)
        response = self.make_request("GET", "/deliveries")
        if response["status_code"] in [401, 403]:
            self.log_test("Get Deliveries (No Auth)", True, "Correctly rejected unauthenticated request")
        else:
            self.log_test("Get Deliveries (No Auth)", False, "Should reject unauthenticated request", response["data"])
    
    def test_payment_management(self):
        """Test payment management endpoints"""
        print("\n=== Testing Payment Management ===")
        
        # Test get payments with admin token
        if self.admin_token:
            response = self.make_request("GET", "/payments", token=self.admin_token)
            if response["success"]:
                self.log_test("Get Payments (Admin)", True, f"Retrieved {len(response['data'])} payments")
            else:
                self.log_test("Get Payments (Admin)", False, "Failed to get payments", response["data"])
        
        # Test get payments with customer token
        if self.customer_token:
            response = self.make_request("GET", "/payments", token=self.customer_token)
            if response["success"]:
                self.log_test("Get Payments (Customer)", True, f"Customer can view payments: {len(response['data'])} payments")
            else:
                self.log_test("Get Payments (Customer)", False, "Customer failed to get payments", response["data"])
        
        # Test get payments without token (should fail)
        response = self.make_request("GET", "/payments")
        if response["status_code"] in [401, 403]:
            self.log_test("Get Payments (No Auth)", True, "Correctly rejected unauthenticated request")
        else:
            self.log_test("Get Payments (No Auth)", False, "Should reject unauthenticated request", response["data"])
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🧪 Starting PureMilk Backend API Tests")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run tests in order
        self.test_user_registration()
        self.test_user_login()
        self.test_jwt_token_validation()
        self.test_customer_management_crud()
        self.test_dashboard_stats()
        self.test_delivery_management()
        self.test_payment_management()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = PureMilkAPITester()
    results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    if results["failed"] > 0:
        exit(1)
    else:
        print("\n🎉 All tests passed!")
        exit(0)