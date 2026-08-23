# 🏛️ Civic Issue Reporting System

**Empowering Communities Through Digital Governance**

A full-stack civic-tech platform MVP that allows citizens to report civic issues with photo evidence, GPS location, and real-time tracking.

> **See It. Report It. Fix It.**

---

## 🚀 Features

- **User Registration & Login** — JWT-based secure authentication
- **Citizen Dashboard** — Overview of reports with stats and activity
- **Multi-Step Report Wizard** — Category → Evidence → Location → Details → Review
- **Photo Evidence** — Upload or capture photos directly from mobile camera
- **GPS Location** — Auto-detect with Leaflet/OpenStreetMap map visualization
- **Reverse Geocoding** — Convert coordinates to human-readable addresses
- **Complaint Tracking** — Unique complaint IDs (CIV-10001, CIV-10002...)
- **Status Timeline** — Visual progression: Submitted → Under Review → Resolved
- **Responsive Design** — Mobile-first, works on all devices
- **Category-based Routing** — Auto-assigns department and priority

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | MongoDB, Mongoose |
| **Auth** | JWT, bcryptjs |
| **File Upload** | Multer (local storage) |
| **Maps** | Leaflet + OpenStreetMap (free, no API key needed) |
| **Geocoding** | Nominatim (OpenStreetMap, free) |

---

## 📁 Project Structure

```
civic-issue-reporting/
├── frontend/              # Next.js frontend
│   ├── app/               # App Router pages
│   ├── components/        # React components
│   │   ├── layout/        # Navbar, MobileNav, DashboardLayout
│   │   ├── pages/         # Page-level components
│   │   └── ui/            # Reusable UI (Button, Input, Badge, Toast...)
│   ├── lib/               # API client, Auth context
│   └── types/             # TypeScript interfaces
│
├── backend/               # Express.js API
│   ├── src/
│   │   ├── config/        # Database & env config
│   │   ├── controllers/   # Auth & Complaint controllers
│   │   ├── middleware/     # Auth, Upload, Validation
│   │   ├── models/        # User, Complaint, Counter
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Response helpers, errors
│   │   ├── seed.ts        # Database seeder
│   │   └── server.ts      # Entry point
│   └── uploads/           # Uploaded files
│
└── README.md
```

---

## ⚙️ Environment Setup

### Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the Repository

```bash
git clone <repository-url>
cd civic-issue-reporting
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file (or copy from `.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/civic-issue-reporting
JWT_SECRET=your_jwt_secret_key_change_in_production
CLIENT_URL=http://localhost:3000
```

> For MongoDB Atlas, replace `MONGODB_URI` with your connection string.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local` file (or copy from `.env.local.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 🗃️ Database Seeding

Seed the database with demo data:

```bash
cd backend
npm run seed
```

This creates:
- **Demo Citizen** account
- **5 sample complaints** with varied statuses

---

## 🏃 Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
npm run dev
```

Server starts at: `http://localhost:5000`

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

App opens at: `http://localhost:3000`

---

## 🎯 Demo Credentials

| Field | Value |
|-------|-------|
| **Email** | `citizen@civic.local` |
| **Password** | `Staff@123` |

Or use the **"Continue as Demo Citizen"** button on the login page.

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new citizen |
| POST | `/api/auth/login` | Login & get JWT token |
| GET | `/api/auth/me` | Get current user (protected) |

### Complaints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/complaints` | Create complaint (multipart, protected) |
| GET | `/api/complaints/my` | Get my complaints (protected) |
| GET | `/api/complaints/:id` | Get complaint details (protected) |

---

## 📱 Demo Flow (< 3 minutes)

1. Open `http://localhost:3000`
2. Click **Login** → Use demo credentials or "Demo Citizen" button
3. View **Citizen Dashboard** with stats and recent complaints
4. Click **Report an Issue**
5. Select a category (e.g., Pothole)
6. Upload a photo
7. Detect GPS location (or click map)
8. Add a description
9. Review and **Submit**
10. See generated **Complaint ID** (CIV-XXXXX)
11. Go to **My Complaints**
12. Click a complaint to see **full details & timeline**

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection error | Ensure MongoDB is running locally or Atlas URI is correct |
| Backend won't start | Check `.env` file exists with valid `MONGODB_URI` |
| Frontend API errors | Ensure backend is running on port 5000 |
| Demo login fails | Run `npm run seed` in the backend directory |
| Map not loading | Check internet connection (uses OpenStreetMap tiles) |
| Image upload fails | Ensure `backend/uploads/` directory exists |

---

## 🔮 Future Features

- AI-powered issue classification
- Department routing & assignment
- Field worker mobile portal
- Admin analytics dashboard
- SLA engine & escalation
- SMS/WhatsApp notifications
- Public civic map
- Predictive analytics

---

## 📄 License

MIT License — Built for academic demonstration.
