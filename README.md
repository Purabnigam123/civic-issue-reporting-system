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
| **Frontend** | React 19, Vite, JavaScript, Tailwind CSS |
| **Backend** | Python, FastAPI, Uvicorn |
| **Database** | MongoDB, Motor |
| **Auth** | JWT, bcrypt |
| **File Upload** | FastAPI multipart uploads (local storage) |
| **Maps** | Leaflet + OpenStreetMap (free, no API key needed) |
| **Geocoding** | Nominatim (OpenStreetMap, free) |

---

## 📁 Project Structure

```
civic-issue-reporting/
├── frontend/react-app/    # Vite React frontend
│   └── src/               # Pages, components, context and API services
│
├── backend/               # FastAPI API
│   ├── app/               # Routers, models, services and configuration
│   ├── tests/             # Pytest suite
│   ├── requirements.txt
│   └── uploads/           # Uploaded files
│
└── README.md
```

---

## ⚙️ Environment Setup

### Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.11+ and pip
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the Repository

```bash
git clone <repository-url>
cd civic-issue-reporting
```

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` file (or copy from `.env.example`):

```env
MONGODB_URI=mongodb://localhost:27017/civic-issue-reporting
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_MINUTES=1440
```

> For MongoDB Atlas, replace `MONGODB_URI` with your connection string.

### 3. Frontend Setup

```bash
cd frontend/react-app
npm install
```

Create `.env.local` file (or copy from `.env.local.example`):

```env
VITE_API_URL=http://localhost:5000/api
```

---

---

## 🏃 Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
uvicorn app.main:app --reload --port 5000
```

Server starts at: `http://localhost:5000`

### Start Frontend (Terminal 2)

```bash
cd frontend/react-app
npm run dev
```

App opens at: `http://localhost:3000`

---

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
| POST | `/api/complaints` | Create complaint with image evidence (multipart, protected) |
| GET | `/api/complaints/my` | Get my complaints (protected) |
| GET | `/api/complaints/:id` | Get complaint details (protected) |
| GET | `/api/complaints/track/:complaintId` | Public, redacted status tracking |
| GET | `/api/complaints/public-stats` | Public aggregate statistics |
| POST | `/api/ai/verify-issue` | AI-assisted image analysis |

---

## 📱 Demo Flow (< 3 minutes)

1. Open `http://localhost:3000`
2. Click **Register** to create a citizen account, then sign in
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
| Login fails | Confirm your account exists and that the API is running |
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
