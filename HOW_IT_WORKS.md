# CivicPulse - How Everything Works

## Table of Contents
1. [System Architecture](#system-architecture)
2. [User Authentication Flow](#user-authentication-flow)
3. [Complaint Submission Flow](#complaint-submission-flow)
4. [AI Verification System](#ai-verification-system)
5. [Status Tracking Mechanism](#status-tracking-mechanism)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Architecture](#backend-architecture)
8. [Database Structure](#database-structure)
9. [API Communication](#api-communication)
10. [Real-time Updates](#real-time-updates)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│              (React App - Browser/Mobile)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/HTTP Requests
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND API                             │
│    (FastAPI - Python Running on Port 8000)                  │
├─────────────────────────────────────────────────────────────┤
│  • Authentication Router      → /api/auth                    │
│  • Complaint Router           → /api/complaints              │
│  • AI Verification Router     → /api/ai                      │
│  • File Upload Handler        → Multipart Upload             │
└──────────────────────┬──────────────────────────────────────┘
                       │ Database Queries
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                          │
│         (NoSQL - Running on Port 27017)                      │
├─────────────────────────────────────────────────────────────┤
│  • Users Collection                                          │
│  • Complaints Collection                                     │
│  • Counters Collection                                       │
└─────────────────────────────────────────────────────────────┘

                  ↓ (On Image Upload)

┌─────────────────────────────────────────────────────────────┐
│                 YOLO AI MODEL                                │
│     (Object Detection - Computer Vision)                     │
├─────────────────────────────────────────────────────────────┤
│  Detects: Potholes, Damaged Roads, Debris, etc.             │
│  Input: Image File (JPG, PNG)                               │
│  Output: Confidence Score + Detected Objects                │
└─────────────────────────────────────────────────────────────┘
```

---

## User Authentication Flow

### Registration Process

```
1. USER FILLS REGISTRATION FORM
   ├─ Name: "John Doe"
   ├─ Email: "john@example.com"
   ├─ Phone: "9876543210"
   └─ Password: "SecurePass123"
                      ↓
2. FRONTEND VALIDATION (Client-Side)
   ├─ Check password length ≥ 8
   ├─ Check password confirmation match
   ├─ Check phone number format (10 digits)
   ├─ Check email format
   └─ Check no empty fields
                      ↓
3. SEND TO BACKEND
   POST /api/auth/register
   Headers: Content-Type: application/json
   Body: {
     "name": "John Doe",
     "email": "john@example.com",
     "phone": "9876543210",
     "password": "SecurePass123"
   }
                      ↓
4. BACKEND PROCESSING
   ├─ Receive request in auth.py register endpoint
   ├─ Validate input using UserCreate schema
   ├─ Check if email already exists in database
   │  └─ If exists: Return 409 Conflict error
   ├─ Hash password using bcrypt (10 rounds)
   ├─ Create user document with:
   │  ├─ name
   │  ├─ email
   │  ├─ phone
   │  ├─ password_hash
   │  ├─ role: "citizen" (default)
   │  └─ created_at: timestamp
   ├─ Generate JWT token:
   │  ├─ Header: {"alg": "HS256", "typ": "JWT"}
   │  ├─ Payload: {"sub": email, "exp": 24hrs}
   │  └─ Signature: HMAC-SHA256(secret_key)
   └─ Return 201 Created
                      ↓
5. FRONTEND RECEIVES RESPONSE
   ├─ Extract token from response
   ├─ Extract user data
   ├─ Store token in localStorage
      Key: "token"
      Value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ├─ Store user in localStorage
      Key: "user"
      Value: {id, name, email, phone, role}
   └─ Redirect to dashboard
                      ↓
6. USER IS LOGGED IN
   ├─ AuthContext updated with user data
   ├─ Protected routes now accessible
   ├─ User name displays in navbar
   └─ Token attached to all future API requests
```

### Login Process

```
1. USER ENTERS CREDENTIALS
   ├─ Email: "john@example.com"
   └─ Password: "SecurePass123"
                      ↓
2. FRONTEND VALIDATION
   ├─ Check email format
   └─ Check password not empty
                      ↓
3. SEND TO BACKEND
   POST /api/auth/login
   Body: {
     "email": "john@example.com",
     "password": "SecurePass123"
   }
                      ↓
4. BACKEND AUTHENTICATION
   ├─ Receive login request
   ├─ Find user by email in database
   │  └─ If not found: Return 401 Unauthorized
   ├─ Extract password_hash from user document
   ├─ Compare provided password with hash using bcrypt
   │  └─ bcrypt.verify(provided_password, stored_hash)
   │     └─ If mismatch: Return 401 Unauthorized
   ├─ Generate new JWT token (24hr expiry)
   └─ Return 200 OK with token and user data
                      ↓
5. FRONTEND PROCESSES LOGIN
   ├─ Store token and user in localStorage
   ├─ Update AuthContext
   └─ Redirect to dashboard
                      ↓
6. SUBSEQUENT API CALLS
   Authorization Header: "Bearer eyJhbGciOiJIUzI1NiIs..."
   ↓
   Backend validates token:
   ├─ Extract token from Authorization header
   ├─ Decode JWT using secret key
   ├─ Verify signature
   ├─ Check expiration timestamp
   └─ If all valid, allow request; otherwise return 401
```

### Logout Process

```
1. USER CLICKS LOGOUT BUTTON
                      ↓
2. FRONTEND ACTIONS
   ├─ Clear token from localStorage
   ├─ Clear user data from localStorage
   ├─ Clear AuthContext (user = null)
   ├─ Remove Authorization header from future requests
   └─ Redirect to login page
                      ↓
3. BACKEND ACTION
   └─ No action needed (stateless JWT)
      Logout happens client-side only
```

---

## Complaint Submission Flow

### Step-by-Step Process

```
1. USER NAVIGATES TO "REPORT ISSUE" PAGE
   ├─ Form displays with fields:
   │  ├─ Category dropdown (Pothole, Streetlight, Garbage, etc.)
   │  ├─ Description text area
   │  ├─ Location picker (map + GPS)
   │  ├─ Image upload (JPG/PNG)
   │  ├─ Audio upload (optional)
   │  └─ Priority selector (Low/Medium/High)
   └─ User fills form
                      ↓
2. FRONTEND VALIDATION
   ├─ Check category selected
   ├─ Check description length ≥ 10 characters
   ├─ Check location captured (GPS coordinates)
   ├─ Check image uploaded
   ├─ Check image size < 10MB
   ├─ Check image format (JPG/PNG)
   └─ If any validation fails: Show error message
                      ↓
3. FILE PROCESSING (Frontend)
   ├─ Read image file
   ├─ Create FormData object
   └─ Store image for upload
                      ↓
4. SEND TO BACKEND
   POST /api/complaints
   Headers:
   ├─ Authorization: "Bearer {token}"
   ├─ Content-Type: multipart/form-data
   Body:
   ├─ category: "pothole"
   ├─ description: "Large pothole on Main Street"
   ├─ latitude: 28.6139
   ├─ longitude: 77.2090
   ├─ priority: "high"
   ├─ image: <binary file data>
   └─ audio: <binary file data> (optional)
                      ↓
5. BACKEND FILE HANDLING
   ├─ Receive multipart form data
   ├─ Extract files from request
   ├─ Save image to disk:
   │  └─ Path: /backend/uploads/{timestamp}_{filename}
   ├─ Validate image format (JPEG/PNG only)
   ├─ Check file size
   ├─ Save audio if provided
   └─ Continue to next step
                      ↓
6. BACKEND AI VERIFICATION
   ├─ Load YOLO model (yolov8n.pt)
   ├─ Read uploaded image
   ├─ Run object detection
   ├─ Extract detected objects and confidence scores
   ├─ Match category with detected objects
   ├─ Generate verification score (0-100%)
   └─ Store verification results
                      ↓
7. DATABASE STORAGE
   ├─ Get next complaint ID from counters collection
   ├─ Create complaint document:
   │  ├─ complaint_id: 1001
   │  ├─ citizen_id: user._id
   │  ├─ category: "pothole"
   │  ├─ description: "..."
   │  ├─ latitude: 28.6139
   │  ├─ longitude: 77.2090
   │  ├─ priority: "high"
   │  ├─ image_path: "/backend/uploads/..."
   │  ├─ audio_path: "/backend/uploads/..." (if provided)
   │  ├─ status: "SUBMITTED"
   │  ├─ ai_verification: {
   │  │  ├─ score: 87.5,
   │  │  ├─ detected_objects: ["pothole", "road_damage"],
   │  │  └─ confidence: 0.92
   │  ├─ created_at: timestamp
   │  ├─ updated_at: timestamp
   │  └─ assigned_to: null (until reviewed)
   ├─ Insert complaint into database
   ├─ Increment complaint counter
   └─ Return 201 Created
                      ↓
8. FRONTEND RECEIVES RESPONSE
   ├─ Extract complaint_id from response
   ├─ Show success message
   │  "Thank you! Your complaint #1001 has been submitted"
   ├─ Display AI verification results
   │  "Issue verified with 87.5% confidence"
   └─ Redirect to complaint tracking page
                      ↓
9. USER SEES THEIR COMPLAINT
   ├─ Dashboard shows new complaint in "My Complaints"
   ├─ Status shows "SUBMITTED"
   ├─ Can view image, audio, and AI verification details
   ├─ Can track status in real-time
   └─ Receives notifications when status changes
```

### Data Flow During Submission

```
FRONTEND                          BACKEND                          DATABASE
┌──────────────┐                 ┌──────────────┐                ┌──────────────┐
│ User fills   │                 │              │                │              │
│ form         │                 │              │                │              │
└──────────────┘                 │              │                │              │
      │                          │              │                │              │
      │ FormData with            │              │                │              │
      │ image/audio              │              │                │              │
      ├─────────────────────────→│ Validate     │                │              │
      │ POST /api/complaints     │ inputs       │                │              │
      │ + auth token             │              │                │              │
      │                          ├─────────────→│ Save image     │              │
      │                          │              │ to disk        │              │
      │                          │              ├───────────────→│ Create       │
      │                          │              │ Load YOLO      │ complaint    │
      │                          │ Run AI       │ Run inference  │ document     │
      │                          │ verification│                │              │
      │                          │              │                │              │
      │                          │              │←───────────────┤ Return ID    │
      │                          │              │ Insert         │              │
      │                          │              │ complaint      │              │
      │                          │              │                │              │
      │←─────────────────────────┤ Return 201   │                │              │
      │ complaint_id: 1001       │ + data       │                │              │
      │ ai_verification: {..}    │              │                │              │
      │                          │              │                │              │
      │ Show success             │              │                │              │
      │ Redirect to tracking     │              │                │              │
      │                          │              │                │              │
```

---

## AI Verification System

### How YOLO Detection Works

```
IMAGE UPLOAD
│
├─ Input: JPG/PNG Image (200x200 to 4000x4000 px)
│
├─ PREPROCESSING
│  ├─ Load image file
│  ├─ Resize to standard size (640x640)
│  ├─ Normalize pixel values (0-1 range)
│  └─ Convert to tensor format
│
├─ YOLO INFERENCE
│  ├─ Pass through neural network layers:
│  │  ├─ Backbone: Extract features from image
│  │  ├─ Neck: Combine multi-scale features
│  │  └─ Head: Generate predictions
│  ├─ For each detected object:
│  │  ├─ Bounding box (x, y, width, height)
│  │  ├─ Confidence score (0-1)
│  │  └─ Class label (pothole, road_damage, etc.)
│  └─ Apply NMS (Non-Maximum Suppression)
│     └─ Remove duplicate detections
│
├─ POSTPROCESSING
│  ├─ Filter detections by confidence > threshold (0.5)
│  ├─ Convert coordinates back to original image size
│  ├─ Format results as JSON
│  └─ Calculate verification score
│
└─ OUTPUT
   {
     "detected_objects": [
       {
         "class": "pothole",
         "confidence": 0.92,
         "bbox": [100, 150, 200, 250]
       },
       {
         "class": "road_damage",
         "confidence": 0.87,
         "bbox": [50, 100, 150, 200]
       }
     ],
     "verification_score": 87.5,
     "verified": true
   }
```

### Verification Logic

```
CATEGORY: Pothole
DETECTED: pothole, road_damage
CONFIDENCE: 92%, 87%

SCORING:
├─ Exact match (Pothole == pothole): +80 points
├─ Related detection (road_damage detected): +15 points
├─ Confidence penalty: -7.5 points (if < 90%)
│
└─ FINAL SCORE: 87.5%
   └─ Status: VERIFIED ✓

CATEGORY: Streetlight
DETECTED: light_fixture, debris
CONFIDENCE: 95%, 75%

SCORING:
├─ Partial match (streetlight ≈ light_fixture): +50 points
├─ Related detection: +20 points
├─ High confidence bonus: +25 points
│
└─ FINAL SCORE: 95%
   └─ Status: VERIFIED ✓

CATEGORY: Garbage
DETECTED: cars, buildings
CONFIDENCE: 85%, 91%

SCORING:
├─ No related detection: 0 points
├─ Irrelevant objects found: -20 points
│
└─ FINAL SCORE: 0%
   └─ Status: MANUAL REVIEW REQUIRED
```

---

## Status Tracking Mechanism

### Complaint Status Lifecycle

```
                    ┌──────────────────────┐
                    │   SUBMITTED (New)    │
                    │  Status: SUBMITTED   │
                    │  Assigned: None      │
                    │  Time: User submits  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   ASSIGNED           │
                    │  Admin reviews       │
                    │  Assigns to dept     │
                    │  Time: Auto/Manual   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  IN_PROGRESS         │
                    │  Department starts   │
                    │  working on issue    │
                    │  Time: 1-3 days      │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  UNDER_REVIEW        │
                    │  Quality check       │
                    │  by supervisor       │
                    │  Time: 1 day         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │    RESOLVED          │
                    │  Issue fixed         │
                    │  Photos uploaded     │
                    │  SLA: On time/Late   │
                    └──────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │    CLOSED            │
                    │  Citizen reviews     │
                    │  Marks as complete   │
                    │  Gives rating        │
                    └──────────────────────┘
```

### Tracking for Citizens

```
DASHBOARD VIEW
┌──────────────────────────────────────────────┐
│ My Complaints (3 Total)                      │
├──────────────────────────────────────────────┤
│                                              │
│ #1001 - Pothole on Main St          [HIGH]  │
│ Status: UNDER_REVIEW (67% Complete)        │
│ ▓▓▓▓▓▓▓████░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│ Days elapsed: 3/5                           │
│ Last update: 2 hours ago                    │
│ • 2026-09-10: Submitted                     │
│ • 2026-09-11: Assigned to Roads Dept        │
│ • 2026-09-12: Work started                  │
│ • 2026-09-12: Quality review begun          │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│ #1000 - Broken Streetlight      [RESOLVED]  │
│ Status: RESOLVED ✓                          │
│ Days elapsed: 2/3                           │
│ Completed: 2026-09-11                       │
│ • View photos of completed work             │
│ • Rate department (Excellent!)              │
│                                              │
└──────────────────────────────────────────────┘

REAL-TIME UPDATES
├─ Notification: "Your complaint #1001 has been assigned"
├─ Email: "Status update: Work in progress on Pothole"
├─ SMS: "Your issue #1001 is under quality review"
└─ In-app badge: Red dot on "My Complaints" tab
```

---

## Frontend Architecture

### Component Hierarchy

```
App (Main Component)
│
├─ AuthContext Provider
│  │
│  ├─ Header/Navbar
│  │  ├─ Logo & Title
│  │  ├─ Navigation Links
│  │  ├─ User Profile Menu
│  │  └─ Logout Button
│  │
│  ├─ Routes
│  │  ├─ Public Routes
│  │  │  ├─ LandingPage
│  │  │  │  ├─ Hero Section
│  │  │  │  ├─ Features Overview
│  │  │  │  ├─ Municipality Showcase
│  │  │  │  ├─ How It Works
│  │  │  │  └─ Footer
│  │  │  │
│  │  │  ├─ LoginPage
│  │  │  │  ├─ Email input
│  │  │  │  ├─ Password input
│  │  │  │  ├─ Login button
│  │  │  │  └─ Register link
│  │  │  │
│  │  │  └─ RegisterPage
│  │  │     ├─ Name input
│  │  │     ├─ Email input
│  │  │     ├─ Phone input
│  │  │     ├─ Password input
│  │  │     ├─ Confirm password input
│  │  │     └─ Register button
│  │  │
│  │  ├─ Protected Routes
│  │  │  ├─ DashboardPage
│  │  │  │  ├─ User stats (greeting)
│  │  │  │  ├─ My Complaints List
│  │  │  │  ├─ Statistics cards
│  │  │  │  └─ Recent activity
│  │  │  │
│  │  │  ├─ ReportIssuePage
│  │  │  │  ├─ Category selector
│  │  │  │  ├─ Description input
│  │  │  │  ├─ Location picker (Map)
│  │  │  │  ├─ Image upload
│  │  │  │  ├─ Audio upload
│  │  │  │  ├─ Priority selector
│  │  │  │  └─ Submit button
│  │  │  │
│  │  │  ├─ ComplaintsPage (History)
│  │  │  │  ├─ Filters
│  │  │  │  │  ├─ Status filter
│  │  │  │  │  ├─ Category filter
│  │  │  │  │  └─ Date range filter
│  │  │  │  ├─ Search bar
│  │  │  │  └─ Complaint list
│  │  │  │
│  │  │  ├─ ComplaintDetailPage
│  │  │  │  ├─ Complaint info
│  │  │  │  ├─ Image gallery
│  │  │  │  ├─ Status timeline
│  │  │  │  ├─ AI verification details
│  │  │  │  ├─ Department info
│  │  │  │  └─ Feedback form
│  │  │  │
│  │  │  └─ ProfilePage
│  │  │     ├─ User info
│  │  │     ├─ Statistics
│  │  │     ├─ Settings
│  │  │     └─ Preferences
│  │  │
│  │  └─ ProtectedRoute Component
│  │     └─ Redirects to login if not authenticated
│  │
│  └─ Footer
│     ├─ Links
│     ├─ Social media
│     └─ Copyright
│
└─ Modal Components (Overlay)
   ├─ TrackComplaintModal
   │  ├─ Complaint ID input
   │  ├─ Status display
   │  └─ Close button
   │
   └─ StatusBadge
      ├─ SUBMITTED (Gray)
      ├─ ASSIGNED (Blue)
      ├─ IN_PROGRESS (Orange)
      ├─ UNDER_REVIEW (Yellow)
      ├─ RESOLVED (Green)
      └─ CLOSED (Purple)
```

### Data Flow in React

```
1. AUTHENTICATION FLOW
   ┌────────────────────────────────┐
   │ localStorage                   │
   │ ├─ token                       │
   │ └─ user                        │
   └────────────────────────────────┘
            ↓ Read on app load
   ┌────────────────────────────────┐
   │ AuthContext                    │
   │ ├─ user (current user)         │
   │ ├─ loading (init state)        │
   │ └─ functions:                  │
   │    ├─ register()               │
   │    ├─ login()                  │
   │    ├─ logout()                 │
   │    └─ getMe()                  │
   └────────────────────────────────┘
            ↓ Consumed by components
   ┌────────────────────────────────┐
   │ Components using useAuth()     │
   │ ├─ ProtectedRoute              │
   │ ├─ Navbar                      │
   │ ├─ LoginPage                   │
   │ ├─ RegisterPage                │
   │ └─ DashboardPage               │
   └────────────────────────────────┘

2. API DATA FLOW
   ┌────────────────────────────────┐
   │ API Service (api.js)           │
   │ ├─ Base URL config             │
   │ ├─ Axios instance              │
   │ └─ Interceptors:               │
   │    ├─ Request: Add auth token  │
   │    └─ Response: Handle 401     │
   └────────────────────────────────┘
            ↓ Used by services
   ┌────────────────────────────────┐
   │ Service Modules                │
   │ ├─ authService.js              │
   │ ├─ complaintService.js         │
   │ └─ etc.                        │
   └────────────────────────────────┘
            ↓ Used by components
   ┌────────────────────────────────┐
   │ Page Components                │
   │ ├─ useState (local state)      │
   │ ├─ useEffect (fetch data)      │
   │ └─ Render UI                   │
   └────────────────────────────────┘

3. FORM SUBMISSION FLOW
   User Input
        ↓
   Form Validation (Frontend)
        ↓
   Call Service Function
        ↓
   Axios Request (with token)
        ↓
   Backend Processing
        ↓
   Response/Error
        ↓
   Update Component State
        ↓
   Re-render UI
```

---

## Backend Architecture

### Request Processing Pipeline

```
INCOMING HTTP REQUEST
│
├─ CORS Middleware
│  ├─ Check Origin (localhost:3000, localhost:5173)
│  ├─ Add CORS headers to response
│  └─ Allow request if origin matches
│
├─ Authentication Middleware
│  ├─ Extract Authorization header
│  ├─ Parse JWT token
│  ├─ Verify signature
│  ├─ Check expiration
│  └─ Extract user_id from token (or return 401)
│
├─ Route Matching
│  ├─ Match URL pattern to router
│  ├─ Match HTTP method (GET, POST, PUT, DELETE)
│  └─ Call appropriate endpoint function
│
├─ REQUEST HANDLER
│  ├─ Validate input using Pydantic schema
│  ├─ Check request body format
│  ├─ Perform business logic
│  ├─ Database operations (async)
│  └─ File operations (if needed)
│
├─ ERROR HANDLING
│  ├─ Try-Catch block
│  ├─ Log error
│  ├─ Return appropriate HTTP status
│  ├─ 200 OK: Success
│  ├─ 201 Created: Resource created
│  ├─ 400 Bad Request: Invalid input
│  ├─ 401 Unauthorized: Not authenticated
│  ├─ 409 Conflict: Resource exists
│  └─ 500 Server Error: Internal error
│
└─ RESPONSE
   ├─ JSON body with data/error
   ├─ HTTP status code
   ├─ Headers (Content-Type, CORS, etc.)
   └─ Sent to client
```

### File Upload & Processing

```
CLIENT UPLOADS FILE
│
├─ POST /api/complaints
├─ Content-Type: multipart/form-data
└─ Body: form fields + file
          │
          ↓
BACKEND RECEIVES
│
├─ Extract files from request
├─ Validate file type (JPG/PNG for images)
├─ Validate file size (< 10MB)
├─ Generate unique filename:
│  └─ Format: {timestamp}_{random}_{original_filename}
│
├─ Save to disk
│  └─ Path: /backend/uploads/{filename}
│
├─ Read image file for AI processing
├─ Pass to YOLO model
│
└─ Store file path in database document
   └─ Field: image_path, audio_path
```

### Database Operations (Async)

```
FASTAPI ASYNC HANDLER
│
├─ Using Motor (async MongoDB driver)
│
├─ Find User
│  └─ db.users.find_one({"email": email})
│
├─ Check Exists (for registration)
│  └─ if user: raise HTTPException(409)
│
├─ Create Document
│  └─ db.users.insert_one({...user_data...})
│
├─ Update Status
│  └─ db.complaints.update_one(
│     {"_id": ObjectId(complaint_id)},
│     {"$set": {"status": "ASSIGNED"}}
│  )
│
├─ Query Multiple
│  └─ db.complaints.find(
│     {"citizen_id": ObjectId(user_id)},
│     sort=[("created_at", -1)]
│  )
│
└─ Transaction Support
   └─ Atomic updates to multiple collections
```

### AI Verification Process

```
1. YOLO MODEL LOADING
   ├─ Check if model in memory
   ├─ If not: Load yolov8n.pt from disk
   ├─ Initialize model
   └─ Cache in memory for future use

2. IMAGE PROCESSING
   ├─ Read image from saved file path
   ├─ Convert to correct format
   ├─ Resize if needed
   └─ Pass to model

3. INFERENCE
   ├─ model.predict(image)
   ├─ Get results object
   ├─ Extract detections
   └─ Extract confidence scores

4. POST-PROCESSING
   ├─ Filter low-confidence results (< 0.5)
   ├─ Format results as JSON
   ├─ Calculate verification score
   ├─ Match with complaint category
   └─ Determine if verified or needs review

5. STORE RESULTS
   ├─ Create verification document
   ├─ Save to complaint record
   ├─ Update status if verified
   └─ Send response to client
```

---

## Database Structure

### Users Collection

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password_hash": "$2b$10$...", // bcrypt hash
  "role": "citizen", // citizen, staff, admin
  "created_at": ISODate("2026-09-12T10:30:00Z"),
  "updated_at": ISODate("2026-09-12T10:30:00Z"),
  "is_active": true,
  "profile": {
    "avatar_url": "https://...",
    "bio": "..."
  }
}
```

### Complaints Collection

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "complaint_id": 1001,
  "citizen_id": ObjectId("507f1f77bcf86cd799439011"),
  "category": "pothole",
  "description": "Large pothole on Main Street near market",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "priority": "high", // low, medium, high
  "status": "IN_PROGRESS", // SUBMITTED, ASSIGNED, IN_PROGRESS, UNDER_REVIEW, RESOLVED, CLOSED
  "image_path": "/backend/uploads/1694508600_abc123_pothole.jpg",
  "audio_path": null,
  "video_path": null,
  "assigned_to": {
    "department": "Roads Department",
    "staff_id": ObjectId("507f1f77bcf86cd799439013"),
    "assigned_at": ISODate("2026-09-11T10:30:00Z")
  },
  "ai_verification": {
    "score": 87.5,
    "verified": true,
    "detected_objects": ["pothole", "road_damage"],
    "confidence": 0.92,
    "verified_at": ISODate("2026-09-12T10:31:00Z")
  },
  "status_history": [
    {
      "status": "SUBMITTED",
      "timestamp": ISODate("2026-09-12T10:30:00Z"),
      "message": "Complaint submitted"
    },
    {
      "status": "ASSIGNED",
      "timestamp": ISODate("2026-09-11T14:00:00Z"),
      "message": "Assigned to Roads Department"
    },
    {
      "status": "IN_PROGRESS",
      "timestamp": ISODate("2026-09-12T09:00:00Z"),
      "message": "Work started by department staff"
    }
  ],
  "sla": {
    "priority": "high",
    "deadline": ISODate("2026-09-15T10:30:00Z"),
    "days_remaining": 3,
    "status": "on_track" // on_track, at_risk, exceeded
  },
  "feedback": {
    "rating": null,
    "comment": null,
    "submitted_at": null
  },
  "created_at": ISODate("2026-09-12T10:30:00Z"),
  "updated_at": ISODate("2026-09-12T14:30:00Z")
}
```

### Counters Collection

```javascript
{
  "_id": "complaint_id",
  "sequence_value": 1001
}
```

---

## API Communication

### Request-Response Examples

#### User Registration

**Request:**
```http
POST /api/auth/register HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass123"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "role": "citizen"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "detail": "Email already registered"
}
```

#### Submit Complaint

**Request:**
```http
POST /api/complaints HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data; boundary=----

------
Content-Disposition: form-data; name="category"

pothole
------
Content-Disposition: form-data; name="description"

Large pothole on Main Street
------
Content-Disposition: form-data; name="latitude"

28.6139
------
Content-Disposition: form-data; name="longitude"

77.2090
------
Content-Disposition: form-data; name="priority"

high
------
Content-Disposition: form-data; name="image"; filename="pothole.jpg"
Content-Type: image/jpeg

[binary image data]
------
```

**Response (201 Created):**
```json
{
  "complaint_id": 1001,
  "status": "SUBMITTED",
  "ai_verification": {
    "score": 87.5,
    "verified": true,
    "detected_objects": ["pothole", "road_damage"],
    "confidence": 0.92
  },
  "message": "Complaint submitted successfully"
}
```

#### Get My Complaints

**Request:**
```http
GET /api/complaints/my HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "complaints": [
    {
      "complaint_id": 1001,
      "category": "pothole",
      "description": "Large pothole on Main Street",
      "status": "IN_PROGRESS",
      "priority": "high",
      "created_at": "2026-09-12T10:30:00Z",
      "sla": {
        "deadline": "2026-09-15T10:30:00Z",
        "days_remaining": 3
      }
    }
  ],
  "total": 1
}
```

---

## Real-time Updates

### Status Update Flow

```
1. DEPARTMENT STAFF UPDATES STATUS
   UI: Click "Mark as In Progress" button
   ├─ POST /api/complaints/{complaint_id}/status
   └─ Body: {"status": "IN_PROGRESS", "message": "Work started"}
                      ↓
2. BACKEND PROCESSES UPDATE
   ├─ Verify staff authorization
   ├─ Update complaint document:
   │  ├─ status: "IN_PROGRESS"
   │  ├─ updated_at: current timestamp
   │  └─ status_history: append new entry
   ├─ Check if SLA still on track
   ├─ Calculate days remaining
   └─ Return 200 OK

3. DATABASE UPDATED
   Complaint record now shows:
   ├─ status: "IN_PROGRESS"
   ├─ status_history: [..., new_entry]
   └─ updated_at: new timestamp

4. CITIZEN NOTIFICATION (Polled from Frontend)
   ├─ Browser periodically calls GET /api/complaints/{id}
   ├─ Checks for status changes
   ├─ If status changed, shows notification:
   │  └─ "Your complaint #1001 is now IN PROGRESS"
   └─ Updates complaint card in UI
```

### Polling vs WebSockets

**Current Implementation (Polling):**
- Frontend polls API every 30-60 seconds
- Lightweight, works everywhere
- Slight delay in updates (up to 60 seconds)
- Lower real-time capability

**Future Enhancement (WebSockets):**
```
Client                    Server
  │                         │
  ├─ Connect ──────────────→ │ (Upgrade HTTP to WebSocket)
  │                         │
  │←─ Connected ─────────── │
  │                         │
  │                    [Complaint updated]
  │←─ Notification ────────┤ (Push to client instantly)
  │  "Status changed"       │
  │                         │
  ├─ Message ─────────────→ │ (Client can also send)
  │  "Send update"          │
  │                         │
  │←─ Response ────────────┤
```

---

## Key Workflows

### Complete Complaint Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                      DAY 1: SUBMISSION                        │
├──────────────────────────────────────────────────────────────┤
│ 10:30 - Citizen submits pothole complaint                   │
│        • Image uploaded                                      │
│        • AI verification: 87.5% confidence                   │
│        • Status: SUBMITTED                                   │
│        • Notification sent to admin                          │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                      DAY 1: ASSIGNMENT                        │
├──────────────────────────────────────────────────────────────┤
│ 14:00 - Admin reviews complaint                              │
│        • Verifies AI detection                               │
│        • Assigns to Roads Department                         │
│        • Sets priority: HIGH                                 │
│        • Status: ASSIGNED                                    │
│        • SLA deadline: 3 days (2026-09-15)                   │
│        • Citizen notified                                    │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                   DAY 2: IN PROGRESS                          │
├──────────────────────────────────────────────────────────────┤
│ 09:00 - Department staff starts work                         │
│        • Status: IN_PROGRESS                                 │
│        • Staff assigned: Raj Kumar (Worker ID: 123)          │
│        • Citizen notified                                    │
│ 16:30 - Progress update posted                              │
│        • Comment: "Excavator on site, filling in progress"  │
│        • New photos uploaded                                 │
│        • Citizen can see progress in real-time               │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                   DAY 3: UNDER REVIEW                         │
├──────────────────────────────────────────────────────────────┤
│ 10:00 - Work appears complete                               │
│        • Staff uploads final photos                          │
│        • Status: UNDER_REVIEW                                │
│        • Supervisor reviews quality                          │
│        • QC check: Approved                                  │
│        • Status: RESOLVED                                    │
│        • Citizen notified: "Issue resolved!"                │
│        • SLA: ON TIME (2 days, deadline was 3 days)         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                   DAY 4: CITIZEN FEEDBACK                     │
├──────────────────────────────────────────────────────────────┤
│ Citizen receives notification                                │
│ Opens complaint detail page                                  │
│ Sees:                                                        │
│  • Before/After photos                                      │
│  • Status timeline                                          │
│  • AI verification report                                   │
│  • Department feedback                                      │
│  • Feedback form to rate service                            │
│                                                              │
│ Citizen rates: ⭐⭐⭐⭐⭐ (5 stars)                            │
│ Comment: "Great job, pothole is completely filled!"         │
│ Status: CLOSED                                               │
│                                                              │
│ Department receives feedback notification                    │
│ Complaint archived for records                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Optimization Strategies

```
1. DATABASE INDEXING
   ├─ users: Index on email (unique, fast login)
   ├─ complaints: Index on citizen_id (fast retrieval)
   ├─ complaints: Index on status (fast filtering)
   └─ complaints: Index on created_at (fast sorting)

2. CACHING
   ├─ YOLO model: Loaded once, cached in memory
   ├─ User data: Cached in localStorage (frontend)
   ├─ Token: Cached in localStorage
   └─ API responses: Cached for 60 seconds (optional)

3. ASYNC OPERATIONS
   ├─ Image processing: Non-blocking
   ├─ Database queries: Async/await with Motor
   ├─ File uploads: Multipart streaming
   └─ Email notifications: Background tasks (future)

4. LAZY LOADING
   ├─ Images: Load on demand, not all at once
   ├─ Complaint details: Load when clicked
   ├─ Maps: Load when needed
   └─ Charts: Load when scrolled into view

5. PAGINATION
   ├─ Complaint list: 10-20 per page
   ├─ Load more button: Fetch next batch
   └─ Infinite scroll: Auto-load on scroll
```

---

## Error Handling

### Frontend Error Handling

```javascript
try {
  // Attempt operation
  const response = await authService.login(email, password);
  setUser(response.user);
  navigate('/dashboard');
} catch (error) {
  if (error.response?.status === 401) {
    // Unauthorized
    setError("Invalid email or password");
  } else if (error.response?.status === 409) {
    // Conflict
    setError("Email already registered");
  } else if (error.response?.status === 500) {
    // Server error
    setError("Server error, please try again later");
  } else if (error.message === 'Network Error') {
    // No internet
    setError("Cannot connect to server. Check your connection.");
  } else {
    // Unknown error
    setError(error.message);
  }
}
```

### Backend Error Handling

```python
@router.post("/login")
async def login(credentials: UserLogin, db = Depends(get_database)):
    try:
        # Find user
        user = await db.users.find_one({"email": credentials.email})
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Verify password
        if not verify_password(credentials.password, user["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Generate token
        token = create_access_token({"sub": str(user["_id"])})
        return {"access_token": token, "user": user}
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        # Log and return generic error
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
```

---

## Summary Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 CIVICPULSE SYSTEM                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FRONTEND (React)                                       │
│  ├─ User Interface                                      │
│  ├─ Form Validation                                     │
│  ├─ State Management (Context API)                      │
│  ├─ Local Storage (Token, User)                         │
│  └─ API Communication (Axios)                           │
│                                                         │
│        ↕↕↕ HTTPS/REST API ↕↕↕                          │
│                                                         │
│  BACKEND (FastAPI - Python)                             │
│  ├─ Authentication (JWT)                                │
│  ├─ Route Handlers                                      │
│  ├─ Business Logic                                      │
│  ├─ File Upload Processing                              │
│  ├─ AI Integration (YOLO)                               │
│  └─ Error Handling                                      │
│                                                         │
│        ↕↕↕ Async Operations ↕↕↕                         │
│                                                         │
│  DATABASE (MongoDB)                                     │
│  ├─ Users Collection                                    │
│  ├─ Complaints Collection                               │
│  └─ Counters Collection                                 │
│                                                         │
│  EXTERNAL SERVICES                                      │
│  ├─ YOLO AI Model                                       │
│  └─ File Storage                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

This comprehensive guide explains every major component and process in CivicPulse!
