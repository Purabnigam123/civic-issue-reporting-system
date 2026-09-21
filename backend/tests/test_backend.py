import io
import sys
from pathlib import Path
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from PIL import Image, ImageDraw

# Ensure backend folder is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.services.complaint_service import get_department, get_priority
from app.models.complaint import ComplaintCategory, ComplaintPriority
from app.models.user import hash_password, verify_password
from app.services.ai_service import analyze_image

client = TestClient(app, raise_server_exceptions=False)


# ─────────────────────────────────────────────
# Unit Tests
# ─────────────────────────────────────────────

def test_password_hashing():
    pwd = "StaffPassword@123"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_complaint_service_mappings():
    assert get_department(ComplaintCategory.POTHOLE) == "Roads Department"
    assert get_department(ComplaintCategory.BROKEN_STREETLIGHT) == "Electrical Department"
    assert get_department(ComplaintCategory.GARBAGE) == "Sanitation Department"
    assert get_department(ComplaintCategory.DRAINAGE) == "Drainage Department"
    assert get_department(ComplaintCategory.WATER_ISSUE) == "Water Supply Department"

    assert get_priority(ComplaintCategory.DRAINAGE) == ComplaintPriority.HIGH
    assert get_priority(ComplaintCategory.GARBAGE) == ComplaintPriority.LOW
    assert get_priority(ComplaintCategory.POTHOLE) == ComplaintPriority.MEDIUM


# ─────────────────────────────────────────────
# Health & 404
# ─────────────────────────────────────────────

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "timestamp" in data
    assert "Civic Issue Reporting API is running" in data["message"]


def test_404_handler():
    response = client.get("/api/non-existent-route-xyz")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Route not found"


# ─────────────────────────────────────────────
# AI Endpoint
# ─────────────────────────────────────────────

def test_ai_verify_endpoint_with_synthetic_image():
    # Create a real synthetic image using PIL
    img = Image.new("RGB", (640, 480), color=(128, 128, 128))
    draw = ImageDraw.Draw(img)
    # Draw a simulated pothole / defect ellipse
    draw.ellipse([(150, 150), (450, 350)], fill=(30, 30, 30), outline=(10, 10, 10))

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    response = client.post(
        "/api/ai/verify-issue",
        files={"image": ("synthetic_pothole.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # A general-purpose model must not claim a verified civic defect when it
    # cannot confidently classify one.
    assert data["verified"] is False
    assert "category" in data
    assert "mappedCategory" in data
    assert "confidence" in data
    assert "boundingBox" in data
    assert data["boundingBox"] is not None
    assert "x" in data["boundingBox"]
    assert "y" in data["boundingBox"]
    assert "width" in data["boundingBox"]
    assert "height" in data["boundingBox"]


# ─────────────────────────────────────────────
# Auth Endpoints (mocked DB)
# ─────────────────────────────────────────────

def _make_db_mock(existing_user=None):
    """Helper to create a mock DB with configurable user lookup."""
    db = MagicMock()
    # users collection
    db.users.find_one = AsyncMock(return_value=existing_user)
    db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="507f1f77bcf86cd799439011"))
    db.users.update_many = AsyncMock(return_value=None)
    # complaints collection
    db.complaints.update_many = AsyncMock(return_value=None)
    db.complaints.find_one = AsyncMock(return_value=None)
    db.complaints.count_documents = AsyncMock(return_value=0)
    db.complaints.aggregate = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    find_cursor = MagicMock()
    find_cursor.sort = MagicMock(return_value=find_cursor)
    find_cursor.to_list = AsyncMock(return_value=[])
    db.complaints.find = MagicMock(return_value=find_cursor)
    return db


def test_register_new_user():
    mock_db = _make_db_mock(existing_user=None)  # no existing user
    with patch("app.routers.auth.get_db", return_value=mock_db), \
         patch("app.config.db.get_db", return_value=mock_db):
        response = client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "test@example.com",
            "phone": "9876543210",
            "password": "password123"
        })
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "token" in data["data"]
    assert data["data"]["user"]["email"] == "test@example.com"


def test_register_duplicate_email():
    existing = {
        "_id": "507f1f77bcf86cd799439011",
        "email": "test@example.com",
        "name": "Existing",
        "phone": "1234567890",
        "role": "CITIZEN"
    }
    mock_db = _make_db_mock(existing_user=existing)
    with patch("app.routers.auth.get_db", return_value=mock_db):
        response = client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "test@example.com",
            "phone": "9876543210",
            "password": "password123"
        })
    assert response.status_code == 409


def test_login_invalid_credentials():
    mock_db = _make_db_mock(existing_user=None)  # user not found
    with patch("app.routers.auth.get_db", return_value=mock_db):
        response = client.post("/api/auth/login", json={
            "email": "noone@example.com",
            "password": "wrongpassword"
        })
    assert response.status_code == 401


# ─────────────────────────────────────────────
# Complaints Endpoints (mocked DB)
# ─────────────────────────────────────────────

def test_public_stats_endpoint():
    mock_db = _make_db_mock()
    with patch("app.routers.complaints.get_db", return_value=mock_db):
        response = client.get("/api/complaints/public-stats")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    stats = data["data"]["stats"]
    assert "totalComplaints" in stats
    assert "resolutionRate" in stats


def test_track_complaint_missing_id():
    response = client.get("/api/complaints/track")
    assert response.status_code == 400


def test_create_complaint_requires_authentication():
    response = client.post("/api/complaints/", data={
        "category": "pothole",
        "description": "Large pothole on main road",
        "latitude": "12.9716",
        "longitude": "77.5946",
        "address": "MG Road, Bangalore",
    })
    assert response.status_code == 401


def test_duplicate_check_detects_nearby_issue():
    mock_db = _make_db_mock()
    mock_db.complaints.find = MagicMock(return_value=MagicMock(
        to_list=AsyncMock(return_value=[{
            "_id": "507f1f77bcf86cd799439011",
            "complaintId": "CIV-101",
            "category": "pothole",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "status": "SUBMITTED",
            "createdAt": "2024-01-01T00:00:00",
            "address": "MG Road, Bangalore",
        }])
    ))
    with patch("app.routers.complaints.get_db", return_value=mock_db):
        response = client.post(
            "/api/complaints/check-duplicate",
            json={"category": "pothole", "latitude": 12.9716001, "longitude": 77.5946001}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["duplicate"] is True
    assert data["existingComplaint"]["complaintId"] == "CIV-101"


def test_anonymous_complaint_can_be_created_without_login():
    mock_db = _make_db_mock()
    mock_db.complaints.insert_one = AsyncMock(return_value=MagicMock(inserted_id="507f1f77bcf86cd799439015"))

    img = Image.new("RGB", (200, 200), color=(128, 128, 128))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    with patch("app.routers.complaints.get_db", return_value=mock_db), \
         patch("app.routers.complaints.get_next_complaint_id", AsyncMock(return_value="CIV-500")), \
         patch("app.routers.complaints.save_upload_file", AsyncMock(return_value=("anon_pothole.jpg", "uploads/anon_pothole.jpg"))):
        response = client.post(
            "/api/complaints/",
            data={
                "category": "pothole",
                "description": "Large pothole near the bus stand",
                "latitude": "12.9716",
                "longitude": "77.5946",
                "address": "MG Road, Bangalore",
                "reporterPhone": "9876543210",
                "isAnonymous": "true",
                "reporterName": "Anonymous",
            },
            files=[("files", ("anon_pothole.jpg", io.BytesIO(img_bytes), "image/jpeg"))],
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["complaint"]["isAnonymous"] is True
    assert data["complaint"]["reporterPhone"] == "9876543210"
