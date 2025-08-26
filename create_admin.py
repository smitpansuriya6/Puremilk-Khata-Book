#!/usr/bin/env python3
"""
Script to create an admin account for MilkWeb
"""
import requests
import json
import time
import sys

def create_admin_account():
    """Create admin account"""
    
    # Admin account details
    admin_data = {
        "email": "admin@puremilk.com",
        "password": "admin123456",
        "name": "Admin User",
        "phone": "1234567890",
        "role": "admin"
    }
    
    print("🚀 Creating Admin Account for MilkWeb...")
    print("=" * 50)
    print(f"Email: {admin_data['email']}")
    print(f"Password: {admin_data['password']}")
    print(f"Name: {admin_data['name']}")
    print(f"Phone: {admin_data['phone']}")
    print(f"Role: {admin_data['role']}")
    print("=" * 50)
    
    # Wait for server to be ready
    print("⏳ Waiting for backend server to start...")
    for i in range(30):  # Wait up to 30 seconds
        try:
            response = requests.get("http://localhost:8001/api/health", timeout=2)
            if response.status_code == 200:
                print("✅ Backend server is running!")
                break
        except requests.exceptions.RequestException:
            print(f"⏳ Waiting... ({i+1}/30)")
            time.sleep(1)
    else:
        print("❌ Backend server is not responding. Please start the backend first.")
        return False
    
    # Create admin account
    try:
        print("📝 Creating admin account...")
        response = requests.post(
            "http://localhost:8001/api/auth/register",
            json=admin_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Admin account created successfully!")
            print("🎉 You can now login to the frontend with:")
            print(f"   Email: {admin_data['email']}")
            print(f"   Password: {admin_data['password']}")
            return True
        else:
            print(f"❌ Failed to create admin account. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error creating admin account: {e}")
        return False

if __name__ == "__main__":
    success = create_admin_account()
    if success:
        print("\n🎯 Next steps:")
        print("1. Start the frontend: yarn start (in frontend folder)")
        print("2. Open http://localhost:3000 in your browser")
        print("3. Login with the admin credentials above")
    else:
        print("\n❌ Failed to create admin account. Please check the backend is running.")
        sys.exit(1)

