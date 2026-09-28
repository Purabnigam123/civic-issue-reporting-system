import sys
from pathlib import Path
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.models.complaint import ComplaintCategory, ComplaintPriority, SLAStatus, ComplaintStatus
from app.services.priority_service import calculate_priority_score, _score_to_priority
from app.services.eta_service import calculate_eta, BASE_ETA_HOURS, PRIORITY_MULTIPLIER
from app.services.duplicate_service import _haversine_meters, _jaccard_similarity, find_duplicates


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_score_to_priority_thresholds():
    """Test priority conversion thresholds."""
    assert _score_to_priority(85) == ComplaintPriority.CRITICAL
    assert _score_to_priority(65) == ComplaintPriority.HIGH
    assert _score_to_priority(45) == ComplaintPriority.MEDIUM
    assert _score_to_priority(15) == ComplaintPriority.LOW


def test_haversine_distance_and_jaccard():
    """Test geospatial calculation and text similarity functions."""
    # Distance between CP (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is ~2400 meters
    d = _haversine_meters(28.6315, 77.2167, 28.6129, 77.2295)
    assert 2000.0 <= d <= 3000.0
    assert _haversine_meters(28.6315, 77.2167, 28.6315, 77.2167) == 0.0

    # Jaccard similarity
    sim = _jaccard_similarity("broken pothole in road", "road pothole broken near park")
    assert sim >= 0.5
    assert _jaccard_similarity("water leak", "street light bulb") == 0.0


@pytest.mark.anyio
async def test_eta_calculation_with_mock_db():
    """Test AI Resolution ETA calculation logic."""
    mock_db = MagicMock()
    mock_db.complaints.find.return_value.to_list = AsyncMock(return_value=[])
    mock_db.users.count_documents = AsyncMock(return_value=5)
    mock_db.complaints.count_documents = AsyncMock(return_value=2)

    with patch("app.services.eta_service.get_database", return_value=mock_db):
        res = await calculate_eta(
            category=ComplaintCategory.POTHOLE.value,
            priority=ComplaintPriority.CRITICAL.value,
            district_id="central_delhi"
        )
        assert res["estimated_duration_hours"] > 0
        assert res["estimated_resolution_at"] is not None
        assert 0.0 <= res["eta_confidence"] <= 1.0
        assert res["worker_shortage"] is False


@pytest.mark.anyio
async def test_priority_score_with_mock_db():
    """Test Priority score calculation with mock DB."""
    mock_db = MagicMock()
    mock_db.complaints.count_documents = AsyncMock(return_value=3)

    with patch("app.services.priority_service.get_database", return_value=mock_db):
        res = await calculate_priority_score(
            category=ComplaintCategory.WATER_ISSUE.value,
            latitude=28.6315,
            longitude=77.2167,
            ai_confidence=0.95,
            upvotes=10
        )
        assert 0 <= res["priority_score"] <= 100
        assert res["priority_score"] >= 50
        assert res["priority_level"] in [ComplaintPriority.CRITICAL.value, ComplaintPriority.HIGH.value, ComplaintPriority.MEDIUM.value]
        factors = res["priority_factors"]
        assert factors["category_severity"]["score"] > 25  # Water issue has 0.95 severity
        assert factors["ai_confidence"]["score"] > 15


@pytest.mark.anyio
async def test_predictive_hotspots_insufficient_data():
    """Test Predictive Hotspots engine when data points are below threshold."""
    from app.services.prediction_service import get_predictive_hotspots
    mock_db = MagicMock()
    mock_db.complaints.count_documents = AsyncMock(return_value=2)  # Below min 5

    with patch("app.services.prediction_service.get_database", return_value=mock_db):
        res = await get_predictive_hotspots(days_lookback=30, min_complaints=5)
        assert res["data_quality"]["sufficient_data"] is False
        assert "Insufficient data" in res["data_quality"]["message"]
        assert len(res["hotspots"]) == 0


@pytest.mark.anyio
async def test_assignment_service_scoring():
    """Test AI Worker assignment engine candidate ranking."""
    from app.services.assignment_service import get_worker_assignment_recommendation
    from bson import ObjectId

    mock_db = MagicMock()
    # Mock workers in district
    mock_worker_1 = {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "name": "Ramesh Kumar",
        "worker_id": "W-101",
        "district_id": "central_delhi",
        "availability_status": "AVAILABLE",
        "skills": ["Road Repair", "General Maintenance"],
    }
    mock_worker_2 = {
        "_id": ObjectId("507f1f77bcf86cd799439012"),
        "name": "Suresh Singh",
        "worker_id": "W-102",
        "district_id": "central_delhi",
        "availability_status": "BUSY",
        "skills": ["Plumbing"],
    }

    find_cursor = MagicMock()
    find_cursor.to_list = AsyncMock(return_value=[mock_worker_1, mock_worker_2])
    mock_db.users.find = MagicMock(return_value=find_cursor)
    mock_db.complaints.count_documents = AsyncMock(return_value=1)

    with patch("app.services.assignment_service.get_database", return_value=mock_db):
        res = await get_worker_assignment_recommendation(
            complaint_id="507f1f77bcf86cd799439099",
            district_id="central_delhi",
            category="pothole",
        )
        assert res["recommended_worker"] is not None
        # Ramesh has matching skills and is AVAILABLE, so should score higher than Suresh
        assert res["recommended_worker"]["name"] == "Ramesh Kumar"
        assert len(res["candidates"]) == 2

