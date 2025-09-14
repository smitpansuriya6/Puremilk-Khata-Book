from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ValidationError, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
from enum import Enum
import re
import time
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('puremilk.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration
class Settings:
    MONGO_URL: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME: str = os.environ.get('DB_NAME', 'puremilk_production')
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'change-this-in-production')
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRY_DAYS: int = int(os.environ.get('JWT_EXPIRY_DAYS', '7'))
    CORS_ORIGINS: List[str] = os.environ.get('CORS_ORIGINS', '*').split(',')
    ALLOWED_HOSTS: List[str] = os.environ.get('ALLOWED_HOSTS', '*').split(',')
    RATE_LIMIT_REQUESTS: int = int(os.environ.get('RATE_LIMIT_REQUESTS', '100'))
    RATE_LIMIT_WINDOW: int = int(os.environ.get('RATE_LIMIT_WINDOW', '3600'))
    MAX_CUSTOMER_LIMIT: int = int(os.environ.get('MAX_CUSTOMER_LIMIT', '10000'))
    
settings = Settings()

# Rate limiting storage
rate_limit_storage: Dict[str, List[float]] = {}

# Database connection with connection pooling
client = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global client, db
    try:
        client = AsyncIOMotorClient(
            settings.MONGO_URL,
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            retryWrites=True
        )
        db = client[settings.DB_NAME]
        
        # Create database indexes for performance
        await create_indexes()
        logger.info("Database connected and indexes created successfully")
        
        yield
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise
    finally:
        # Shutdown
        if client:
            client.close()
            logger.info("Database connection closed")

async def create_indexes():
    """Create database indexes for optimal performance"""
    try:
        # Users collection indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")
        await db.users.create_index("is_active")
        
        # Customers collection indexes
        await db.customers.create_index("email", unique=True)
        await db.customers.create_index("created_by")
        await db.customers.create_index("is_active")
        await db.customers.create_index([("name", "text"), ("email", "text"), ("phone", "text")])
        
        # Deliveries collection indexes
        await db.deliveries.create_index("customer_id")
        await db.deliveries.create_index("delivery_date")
        await db.deliveries.create_index("status")
        await db.deliveries.create_index([("customer_id", 1), ("delivery_date", -1)])
        
        # Payments collection indexes
        await db.payments.create_index("customer_id")
        await db.payments.create_index("payment_date")
        await db.payments.create_index("status")
        await db.payments.create_index([("customer_id", 1), ("payment_date", -1)])
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")

# Create the main app
app = FastAPI(
    title="PureMilk Dairy Management System",
    description="Production-ready dairy management API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.environ.get('ENVIRONMENT') != 'production' else None,
    redoc_url="/redoc" if os.environ.get('ENVIRONMENT') != 'production' else None
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS if settings.ALLOWED_HOSTS != ['*'] else ['*']
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=3600
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    CUSTOMER = "customer"

class MilkType(str, Enum):
    COW = "cow"
    BUFFALO = "buffalo"
    GOAT = "goat"
    MIXED = "mixed"

class DeliveryStatus(str, Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"

# Enhanced Models with validation
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password: str
    role: UserRole
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r'^\+?[1-9]\d{1,14}$')
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    is_active: bool = True
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r'^\+?[1-9]\d{1,14}$')
    
    @field_validator('password')
    def validate_password(cls, v):
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^\+?[1-9]\d{1,14}$')
    address: str = Field(..., min_length=10, max_length=500)
    milk_type: MilkType
    daily_quantity: float = Field(..., gt=0, le=50)  # Max 50 liters per day
    rate_per_liter: float = Field(..., gt=0, le=1000)  # Max ₹1000 per liter
    morning_delivery: bool = True
    evening_delivery: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^\+?[1-9]\d{1,14}$')
    address: str = Field(..., min_length=10, max_length=500)
    milk_type: MilkType
    daily_quantity: float = Field(..., gt=0, le=50)
    rate_per_liter: float = Field(..., gt=0, le=1000)
    morning_delivery: bool = True
    evening_delivery: bool = False
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)
    
    @field_validator('password')
    def validate_password(cls, v):
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    def model_validate(self, values):
        if values.get('password') != values.get('confirm_password'):
            raise ValueError('Passwords do not match')
        return values

class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    address: Optional[str] = Field(None, min_length=10, max_length=500)
    milk_type: Optional[MilkType] = None
    daily_quantity: Optional[float] = Field(None, gt=0, le=50)
    rate_per_liter: Optional[float] = Field(None, gt=0, le=1000)
    morning_delivery: Optional[bool] = None
    evening_delivery: Optional[bool] = None
    is_active: Optional[bool] = None

class Delivery(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    delivery_date: datetime
    milk_type: MilkType
    quantity: float = Field(..., gt=0, le=50)
    status: DeliveryStatus = DeliveryStatus.PENDING
    delivery_time: Optional[str] = Field(None, pattern=r'^(morning|evening)$')
    notes: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None

class DeliveryCreate(BaseModel):
    customer_id: str
    delivery_date: datetime
    quantity: float = Field(..., gt=0, le=50)
    delivery_time: str = Field(..., pattern=r'^(morning|evening)$')
    notes: Optional[str] = Field(None, max_length=500)

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    amount: float = Field(..., gt=0)
    payment_date: datetime
    billing_period_start: datetime
    billing_period_end: datetime
    status: PaymentStatus = PaymentStatus.PENDING
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DashboardStats(BaseModel):
    total_customers: int
    active_customers: int
    today_deliveries: int
    pending_deliveries: int
    today_revenue: float
    monthly_revenue: float
    pending_payments: float

# Rate limiting middleware
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    current_time = time.time()
    
    # Clean old entries
    if client_ip in rate_limit_storage:
        rate_limit_storage[client_ip] = [
            timestamp for timestamp in rate_limit_storage[client_ip]
            if current_time - timestamp < settings.RATE_LIMIT_WINDOW
        ]
    else:
        rate_limit_storage[client_ip] = []
    
    # Check rate limit
    if len(rate_limit_storage[client_ip]) >= settings.RATE_LIMIT_REQUESTS:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded"}
        )
    
    # Add current request
    rate_limit_storage[client_ip].append(current_time)
    
    response = await call_next(request)
    return response

app.middleware("http")(rate_limit_middleware)

# Enhanced utility functions
def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_jwt_token(user_id: str, role: str) -> str:
    """Create JWT token with enhanced security"""
    payload = {
        'user_id': user_id,
        'role': role,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=settings.JWT_EXPIRY_DAYS),
        'jti': str(uuid.uuid4())  # JWT ID for token revocation if needed
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    """Verify JWT token with enhanced error handling"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user with enhanced security checks"""
    try:
        payload = verify_jwt_token(credentials.credentials)
        user_doc = await db.users.find_one({"id": payload["user_id"]})
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        user = User(**user_doc)
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User account is disabled")
        
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise HTTPException(status_code=401, detail="User account is temporarily locked")
        
        # Update last login
        await db.users.update_one(
            {"id": user.id},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_current_user: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    """Ensure user has admin privileges"""
    if current_user.role != UserRole.ADMIN:
        logger.warning(f"Unauthorized admin access attempt by user: {current_user.email}")
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Error handlers
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation failed", "errors": exc.errors()}
    )

@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Authentication Routes
@api_router.get("/auth/check-admin")
async def check_admin_exists():
    """Check if admin user already exists"""
    try:
        admin_count = await db.users.count_documents({"role": UserRole.ADMIN.value})
        return {"admin_exists": admin_count > 0}
    except Exception as e:
        logger.error(f"Error checking admin existence: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/auth/debug-email/{email}")
async def debug_email_status(email: str, current_user: User = Depends(get_admin_user)):
    """Debug endpoint to check email status in database"""
    try:
        customer_active = await db.customers.find_one({"email": email, "is_active": True})
        customer_inactive = await db.customers.find_one({"email": email, "is_active": False})
        user_active = await db.users.find_one({"email": email, "is_active": True})
        user_inactive = await db.users.find_one({"email": email, "is_active": False})
        
        return {
            "email": email,
            "customer_active": bool(customer_active),
            "customer_inactive": bool(customer_inactive),
            "user_active": bool(user_active),
            "user_inactive": bool(user_inactive),
            "customer_active_id": customer_active.get("id") if customer_active else None,
            "user_active_id": user_active.get("id") if user_active else None
        }
    except Exception as e:
        logger.error(f"Error debugging email status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    """Register a new user - Only first user can be admin"""
    try:
        # Check if any admin already exists - Only first user can be admin
        if user_data.role == UserRole.ADMIN:
            admin_count = await db.users.count_documents({"role": UserRole.ADMIN.value})
            if admin_count > 0:
                raise HTTPException(status_code=403, detail="Admin already exists. Only the first user can register as admin.")
        
        # Check if user already exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            logger.warning(f"Registration attempt with existing email: {user_data.email}")
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Hash password
        hashed_password = hash_password(user_data.password)
        
        # Create user
        user = User(
            email=user_data.email,
            password=hashed_password,
            role=user_data.role,
            name=user_data.name,
            phone=user_data.phone
        )
        
        await db.users.insert_one(user.dict())
        
        # Create JWT token
        token = create_jwt_token(user.id, user.role.value)
        
        logger.info(f"New user registered: {user.email} with role: {user.role}")
        
        return {
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "name": user.name
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    """Login user with enhanced security"""
    try:
        # Find user
        user_doc = await db.users.find_one({"email": login_data.email})
        if not user_doc:
            # Simulate password verification to prevent timing attacks
            hash_password("dummy_password")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user = User(**user_doc)
        
        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise HTTPException(status_code=401, detail="Account temporarily locked")
        
        # Verify password
        if not verify_password(login_data.password, user.password):
            # Increment failed attempts
            failed_attempts = user.failed_login_attempts + 1
            update_data = {"failed_login_attempts": failed_attempts}
            
            # Lock account after 5 failed attempts
            if failed_attempts >= 5:
                update_data["locked_until"] = datetime.utcnow() + timedelta(minutes=30)
                logger.warning(f"Account locked due to failed attempts: {user.email}")
            
            await db.users.update_one({"id": user.id}, {"$set": update_data})
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Account is disabled")
        
        # Reset failed attempts on successful login
        await db.users.update_one(
            {"id": user.id},
            {"$set": {
                "failed_login_attempts": 0,
                "locked_until": None,
                "last_login": datetime.utcnow()
            }}
        )
        
        # Create JWT token
        token = create_jwt_token(user.id, user.role.value)
        
        logger.info(f"User logged in: {user.email}")
        
        return {
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "name": user.name
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.name,
        "phone": current_user.phone,
        "last_login": current_user.last_login
    }

# Dashboard Routes
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """Get dashboard statistics with role-based filtering"""
    try:
        today = datetime.utcnow().date()
        month_start = datetime(today.year, today.month, 1)
        
        if current_user.role == UserRole.ADMIN:
            # Admin sees all system stats
            total_customers = await db.customers.count_documents({})
            active_customers = await db.customers.count_documents({"is_active": True})
            
            # Today's deliveries
            today_deliveries = await db.deliveries.count_documents({
                "delivery_date": {
                    "$gte": datetime.combine(today, datetime.min.time()),
                    "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
                }
            })
            
            pending_deliveries = await db.deliveries.count_documents({
                "status": DeliveryStatus.PENDING.value,
                "delivery_date": {
                    "$gte": datetime.combine(today, datetime.min.time()),
                    "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
                }
            })
            
            # Revenue calculation with aggregation pipeline for performance
            today_revenue_pipeline = [
                {
                    "$match": {
                        "payment_date": {
                            "$gte": datetime.combine(today, datetime.min.time()),
                            "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
                        },
                        "status": PaymentStatus.PAID.value
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            
            today_revenue_result = await db.payments.aggregate(today_revenue_pipeline).to_list(1)
            today_revenue = today_revenue_result[0]["total"] if today_revenue_result else 0.0
            
            monthly_revenue_pipeline = [
                {
                    "$match": {
                        "payment_date": {"$gte": month_start},
                        "status": PaymentStatus.PAID.value
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            
            monthly_revenue_result = await db.payments.aggregate(monthly_revenue_pipeline).to_list(1)
            monthly_revenue = monthly_revenue_result[0]["total"] if monthly_revenue_result else 0.0
            
            pending_payments_pipeline = [
                {
                    "$match": {
                        "status": {"$in": [PaymentStatus.PENDING.value, PaymentStatus.OVERDUE.value]}
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            
            pending_payments_result = await db.payments.aggregate(pending_payments_pipeline).to_list(1)
            pending_payments_amount = pending_payments_result[0]["total"] if pending_payments_result else 0.0
            
        else:
            # Customer sees only their own stats
            customer_doc = await db.customers.find_one({"email": current_user.email})
            customer_id = customer_doc["id"] if customer_doc else None
            
            total_customers = 1 if customer_doc else 0
            active_customers = 1 if customer_doc else 0
            
            if customer_id:
                today_deliveries = await db.deliveries.count_documents({
                    "customer_id": customer_id,
                    "delivery_date": {
                        "$gte": datetime.combine(today, datetime.min.time()),
                        "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
                    }
                })
                
                pending_deliveries = await db.deliveries.count_documents({
                    "customer_id": customer_id,
                    "status": DeliveryStatus.PENDING.value,
                    "delivery_date": {
                        "$gte": datetime.combine(today, datetime.min.time()),
                        "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
                    }
                })
                
                # Customer's payments using aggregation
                today_revenue_pipeline = [
                    {
                        "$match": {
                            "customer_id": customer_id,
                            "payment_date": {
                                "$gte": datetime.combine(today, datetime.min.time()),
                                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
                            },
                            "status": PaymentStatus.PAID.value
                        }
                    },
                    {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
                ]
                
                today_revenue_result = await db.payments.aggregate(today_revenue_pipeline).to_list(1)
                today_revenue = today_revenue_result[0]["total"] if today_revenue_result else 0.0
                
                monthly_revenue_pipeline = [
                    {
                        "$match": {
                            "customer_id": customer_id,
                            "payment_date": {"$gte": month_start},
                            "status": PaymentStatus.PAID.value
                        }
                    },
                    {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
                ]
                
                monthly_revenue_result = await db.payments.aggregate(monthly_revenue_pipeline).to_list(1)
                monthly_revenue = monthly_revenue_result[0]["total"] if monthly_revenue_result else 0.0
                
                pending_payments_pipeline = [
                    {
                        "$match": {
                            "customer_id": customer_id,
                            "status": {"$in": [PaymentStatus.PENDING.value, PaymentStatus.OVERDUE.value]}
                        }
                    },
                    {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
                ]
                
                pending_payments_result = await db.payments.aggregate(pending_payments_pipeline).to_list(1)
                pending_payments_amount = pending_payments_result[0]["total"] if pending_payments_result else 0.0
            else:
                today_deliveries = 0
                pending_deliveries = 0
                today_revenue = 0.0
                monthly_revenue = 0.0
                pending_payments_amount = 0.0
        
        return DashboardStats(
            total_customers=total_customers,
            active_customers=active_customers,
            today_deliveries=today_deliveries,
            pending_deliveries=pending_deliveries,
            today_revenue=round(today_revenue, 2),
            monthly_revenue=round(monthly_revenue, 2),
            pending_payments=round(pending_payments_amount, 2)
        )
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")

# Customer Management Routes
@api_router.get("/customers", response_model=List[Customer])
async def get_customers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: User = Depends(get_admin_user)
):
    """Get customers with pagination and search"""
    try:
        # Build query
        query = {}
        if search:
            query["$text"] = {"$search": search}
        
        # Get total count
        total = await db.customers.count_documents(query)
        
        # Get customers with pagination
        cursor = db.customers.find(query).skip(skip).limit(min(limit, 100))
        customers = await cursor.to_list(length=limit)
        
        result = [Customer(**customer) for customer in customers]
        
        # Add pagination headers would be done in a real API
        logger.info(f"Retrieved {len(result)} customers (total: {total})")
        
        return result
    except Exception as e:
        logger.error(f"Get customers error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customers")

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_admin_user)):
    """Create a new customer with login credentials"""
    try:
        # Validate password confirmation
        if customer_data.password != customer_data.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match")
        
        # Check customer limit
        customer_count = await db.customers.count_documents({})
        if customer_count >= settings.MAX_CUSTOMER_LIMIT:
            raise HTTPException(status_code=400, detail="Maximum customer limit reached")
        
        # Check if customer email already exists (simple check since we use permanent deletes)
        existing_customer = await db.customers.find_one({"email": customer_data.email})
        if existing_customer:
            raise HTTPException(status_code=400, detail="Customer with this email already exists")
        
        # Check if user email already exists
        existing_user = await db.users.find_one({"email": customer_data.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create customer record
        customer_dict = customer_data.dict()
        customer_dict.pop('password')  # Remove password from customer data
        customer_dict.pop('confirm_password')  # Remove confirm_password from customer data
        customer = Customer(**customer_dict, created_by=current_user.id)
        
        # Create user credentials for customer
        hashed_password = hash_password(customer_data.password)
        user = User(
            email=customer_data.email,
            password=hashed_password,
            role=UserRole.CUSTOMER,
            name=customer_data.name,
            phone=customer_data.phone
        )
        
        # Insert both customer and user
        await db.customers.insert_one(customer.dict())
        await db.users.insert_one(user.dict())
        
        logger.info(f"New customer and user created: {customer.email} by admin: {current_user.email}")
        
        return customer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create customer error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create customer")

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, current_user: User = Depends(get_admin_user)):
    """Get a specific customer"""
    try:
        customer_doc = await db.customers.find_one({"id": customer_id})
        if not customer_doc:
            raise HTTPException(status_code=404, detail="Customer not found")
        return Customer(**customer_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer")

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    current_user: User = Depends(get_admin_user)
):
    """Update a customer with validation"""
    try:
        customer_doc = await db.customers.find_one({"id": customer_id})
        if not customer_doc:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        update_data = {k: v for k, v in customer_data.dict().items() if v is not None}
        
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            
            # Check email uniqueness if email is being updated
            if "email" in update_data:
                existing_customer = await db.customers.find_one({
                    "email": update_data["email"],
                    "id": {"$ne": customer_id}
                })
                if existing_customer:
                    raise HTTPException(status_code=400, detail="Email already exists")
            
            await db.customers.update_one(
                {"id": customer_id},
                {"$set": update_data}
            )
        
        updated_customer = await db.customers.find_one({"id": customer_id})
        
        logger.info(f"Customer updated: {customer_id} by admin: {current_user.email}")
        
        return Customer(**updated_customer)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update customer error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update customer")

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_admin_user)):
    """Permanently delete a customer and their user account"""
    try:
        # First get the customer to find their email
        customer = await db.customers.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer_email = customer["email"]
        
        # Permanently delete the customer record
        result = await db.customers.delete_one({"id": customer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Also permanently delete the associated user account
        user_result = await db.users.delete_one({"email": customer_email})
        
        # Also delete any related delivery records for this customer
        delivery_result = await db.deliveries.delete_many({"customer_id": customer_id})
        
        # Also delete any related payment records for this customer
        payment_result = await db.payments.delete_many({"customer_id": customer_id})
        
        logger.info(f"Customer permanently deleted: {customer_id} ({customer_email}) by admin: {current_user.email}")
        logger.info(f"Associated records deleted - User: {user_result.deleted_count}, Deliveries: {delivery_result.deleted_count}, Payments: {payment_result.deleted_count}")
        
        return {"message": "Customer permanently deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete customer error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete customer")

# Delivery Management Routes
@api_router.get("/deliveries")
async def get_deliveries(
    customer_id: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get deliveries with role-based filtering and date range support"""
    try:
        filter_query = {}
        
        if current_user.role == UserRole.CUSTOMER:
            # Customer can only see their own deliveries
            customer_doc = await db.customers.find_one({"email": current_user.email})
            if customer_doc:
                filter_query["customer_id"] = customer_doc["id"]
            else:
                return []
        elif customer_id:
            filter_query["customer_id"] = customer_id
        
        # Handle date filtering - support both single date and date range
        if start_date and end_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                filter_query["delivery_date"] = {
                    "$gte": start_datetime,
                    "$lte": end_datetime
                }
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date range format")
        elif date:
            try:
                target_date = datetime.fromisoformat(date).date()
                filter_query["delivery_date"] = {
                    "$gte": datetime.combine(target_date, datetime.min.time()),
                    "$lt": datetime.combine(target_date + timedelta(days=1), datetime.min.time())
                }
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format")
        
        cursor = db.deliveries.find(filter_query).sort("delivery_date", -1).skip(skip).limit(min(limit, 100))
        deliveries = await cursor.to_list(length=limit)
        
        return [Delivery(**delivery) for delivery in deliveries]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get deliveries error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch deliveries")

@api_router.post("/deliveries", response_model=Delivery)
async def create_delivery(delivery_data: DeliveryCreate, current_user: User = Depends(get_admin_user)):
    """Create a new delivery"""
    try:
        # Verify customer exists
        customer_doc = await db.customers.find_one({"id": delivery_data.customer_id})
        if not customer_doc:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer = Customer(**customer_doc)
        delivery = Delivery(
            **delivery_data.dict(),
            milk_type=customer.milk_type
        )
        
        await db.deliveries.insert_one(delivery.dict())
        
        logger.info(f"New delivery created for customer: {delivery_data.customer_id}")
        
        return delivery
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create delivery error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create delivery")

@api_router.put("/deliveries/{delivery_id}/status")
async def update_delivery_status(
    delivery_id: str,
    status: DeliveryStatus,
    current_user: User = Depends(get_admin_user)
):
    """Update delivery status"""
    try:
        update_data = {"status": status.value}
        if status == DeliveryStatus.DELIVERED:
            update_data["delivered_at"] = datetime.utcnow()
        
        result = await db.deliveries.update_one(
            {"id": delivery_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Delivery not found")
        
        logger.info(f"Delivery status updated: {delivery_id} to {status.value}")
        
        return {"message": "Delivery status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update delivery status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update delivery status")

class DeliveryUpdate(BaseModel):
    quantity: Optional[float] = None
    status: Optional[DeliveryStatus] = None

@api_router.put("/deliveries/{delivery_id}")
async def update_delivery(
    delivery_id: str,
    delivery_data: DeliveryUpdate,
    current_user: User = Depends(get_admin_user)
):
    """Update delivery quantity and/or status"""
    try:
        update_data = {}
        
        if delivery_data.quantity is not None:
            if delivery_data.quantity <= 0 or delivery_data.quantity > 50:
                raise HTTPException(status_code=400, detail="Quantity must be between 0.1 and 50 liters")
            update_data["quantity"] = delivery_data.quantity
        
        if delivery_data.status is not None:
            update_data["status"] = delivery_data.status.value
            if delivery_data.status == DeliveryStatus.DELIVERED:
                update_data["delivered_at"] = datetime.utcnow()
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        result = await db.deliveries.update_one(
            {"id": delivery_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Delivery not found")
        
        logger.info(f"Delivery updated: {delivery_id}")
        
        return {"message": "Delivery updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update delivery error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update delivery")

# Payment Routes
@api_router.get("/payments")
async def get_payments(
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get payments with role-based filtering"""
    try:
        filter_query = {}
        
        if current_user.role == UserRole.CUSTOMER:
            # Customer can only see their own payments
            customer_doc = await db.customers.find_one({"email": current_user.email})
            if customer_doc:
                filter_query["customer_id"] = customer_doc["id"]
            else:
                return []
        elif customer_id:
            filter_query["customer_id"] = customer_id
        
        cursor = db.payments.find(filter_query).sort("created_at", -1).skip(skip).limit(min(limit, 100))
        payments = await cursor.to_list(length=limit)
        
        return [Payment(**payment) for payment in payments]
    except Exception as e:
        logger.error(f"Get payments error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch payments")

# Health check endpoint
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        await db.users.count_documents({}, limit=1)
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "version": "2.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# Customer-specific routes (for customer dashboard)
@api_router.get("/customer/profile", response_model=Customer)
async def get_customer_profile(current_user: User = Depends(get_current_user)):
    """Get customer's own profile"""
    try:
        if current_user.role != UserRole.CUSTOMER:
            raise HTTPException(status_code=403, detail="Customer access only")
        
        customer_doc = await db.customers.find_one({"email": current_user.email})
        if not customer_doc:
            raise HTTPException(status_code=404, detail="Customer profile not found")
        
        return Customer(**customer_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer profile error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile")

@api_router.get("/customer/deliveries")
async def get_customer_deliveries(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get customer's own deliveries"""
    try:
        if current_user.role != UserRole.CUSTOMER:
            raise HTTPException(status_code=403, detail="Customer access only")
        
        customer_doc = await db.customers.find_one({"email": current_user.email})
        if not customer_doc:
            raise HTTPException(status_code=404, detail="Customer profile not found")
        
        deliveries_cursor = db.deliveries.find(
            {"customer_id": customer_doc["id"]}
        ).sort("delivery_date", -1).skip(skip).limit(limit)
        
        deliveries = await deliveries_cursor.to_list(length=None)
        
        return {"deliveries": deliveries, "count": len(deliveries)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer deliveries error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch deliveries")

@api_router.get("/customer/payments")
async def get_customer_payments(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get customer's own payments"""
    try:
        if current_user.role != UserRole.CUSTOMER:
            raise HTTPException(status_code=403, detail="Customer access only")
        
        customer_doc = await db.customers.find_one({"email": current_user.email})
        if not customer_doc:
            raise HTTPException(status_code=404, detail="Customer profile not found")
        
        payments_cursor = db.payments.find(
            {"customer_id": customer_doc["id"]}
        ).sort("payment_date", -1).skip(skip).limit(limit)
        
        payments = await payments_cursor.to_list(length=None)
        
        return {"payments": payments, "count": len(payments)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer payments error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch payments")

# Include the router in the main app
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",   # keep this
        port=8001,
        reload=True,      # change from False to True
        log_level="info"
    )
