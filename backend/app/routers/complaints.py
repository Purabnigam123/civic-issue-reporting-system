from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request, Body
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from math import radians, sin, cos, sqrt, atan2
from hashlib import sha256
from io import BytesIO
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
import re

from ..models.complaint import ComplaintCategory, ComplaintStatus, format_complaint_dict
from ..models.counter import get_next_complaint_id
from ..dependencies.auth import get_current_user, get_current_user_optional
from ..middleware.upload import save_upload_file
from ..services.complaint_service import get_department, get_priority, get_priority_with_ai, calculate_sla
from ..services.district_service import detect_district_from_address
from ..services.suspicious_service import evaluate_complaint_suspicion
from ..services.status_service import transition_complaint_status
from ..services.ai_service import analyze_image
from ..config.db import get_db

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

MAX_SUBMISSIONS_PER_HOUR = 5
GPS_MISMATCH_METERS = 500.0
MAX_CAPTURE_AGE_DAYS = 365


def _rational_to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        try:
            return float(value.numerator) / float(value.denominator)
        except (AttributeError, TypeError, ValueError, ZeroDivisionError):
            return None


def _normalize_phone(phone: Optional[str]) -> str:
    return re.sub(r"\D", "", phone or "")


def _extract_image_metadata(file_bytes: bytes) -> dict:
    metadata = {"gps": None, "capturedAt": None}
    try:
        from PIL import Image, ExifTags

        image = Image.open(BytesIO(file_bytes))
        exif = image.getexif()
        if not exif:
            return metadata

        gps_info = exif.get(34853)
        if gps_info:
            gps = {
                ExifTags.GPSTAGS.get(key, key): value
                for key, value in gps_info.items()
            }
            lat_values = gps.get("GPSLatitude")
            lon_values = gps.get("GPSLongitude")
            if lat_values and lon_values:
                lat = [_rational_to_float(value) for value in lat_values]
                lon = [_rational_to_float(value) for value in lon_values]
                if all(value is not None for value in lat + lon):
                    latitude = lat[0] + lat[1] / 60 + lat[2] / 3600
                    longitude = lon[0] + lon[1] / 60 + lon[2] / 3600
                    if gps.get("GPSLatitudeRef") == "S":
                        latitude *= -1
                    if gps.get("GPSLongitudeRef") == "W":
                        longitude *= -1
                    metadata["gps"] = {"latitude": latitude, "longitude": longitude}

        captured_value = exif.get(36867) or exif.get(306)
        if captured_value:
            try:
                metadata["capturedAt"] = datetime.strptime(
                    str(captured_value), "%Y:%m:%d %H:%M:%S"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    except Exception:
        return metadata

    return metadata


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * radius * atan2(sqrt(a), sqrt(1 - a))


async def _find_nearby_complaint(category: str, latitude: float, longitude: float, radius_meters: float = 50.0, exclude_complaint_id: Optional[str] = None):
    nearby = await _find_nearby_complaints(category, latitude, longitude, radius_meters, exclude_complaint_id)
    if not nearby:
        return None, 0.0
    nearest = nearby[0]
    return nearest, nearest.get("distanceMeters", 0.0)


async def _find_nearby_complaints(category: str, latitude: float, longitude: float, radius_meters: float = 50.0, exclude_complaint_id: Optional[str] = None):
    db = get_db()
    query = {
        "category": category,
        "latitude": {"$exists": True},
        "longitude": {"$exists": True},
    }
    if exclude_complaint_id:
        query["complaintId"] = {"$ne": exclude_complaint_id}

    cursor = db.complaints.find(query)
    complaints = await cursor.to_list(None)
    nearby = []

    for complaint in complaints:
        if complaint.get("complaintId") == exclude_complaint_id:
            continue
        try:
            existing_lat = float(complaint.get("latitude"))
            existing_lng = float(complaint.get("longitude"))
        except (TypeError, ValueError):
            continue
        distance_meters = _haversine_meters(latitude, longitude, existing_lat, existing_lng)
        if distance_meters <= radius_meters:
            complaint["distanceMeters"] = round(distance_meters, 2)
            nearby.append(complaint)

    return sorted(nearby, key=lambda complaint: complaint["distanceMeters"])


@router.get("/public-stats")
async def get_public_stats():
    db = get_db()
    total_complaints = await db.complaints.count_documents({})
    resolved_complaints = await db.complaints.count_documents({"status": "RESOLVED"})
    in_progress_complaints = await db.complaints.count_documents({"status": {"$in": ["IN_PROGRESS", "ASSIGNED", "UNDER_REVIEW"]}})
    submitted_complaints = await db.complaints.count_documents({"status": "SUBMITTED"})

    category_stats = await db.complaints.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(None)

    status_stats = await db.complaints.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(None)

    department_stats = await db.complaints.aggregate([
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(None)

    resolution_rate = round((resolved_complaints / total_complaints) * 100) if total_complaints > 0 else 0

    stats_payload = {
        "totalComplaints": total_complaints,
        "resolvedComplaints": resolved_complaints,
        "inProgressComplaints": in_progress_complaints,
        "submittedComplaints": submitted_complaints,
        "resolutionRate": resolution_rate,
        "categoryStats": category_stats,
        "statusStats": status_stats,
        "departmentStats": department_stats,
    }

    return {
        "success": True,
        "stats": stats_payload,
        "data": {"stats": stats_payload}
    }


@router.post("/check-duplicate")
async def check_duplicate(payload: dict):
    category = payload.get("category")
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    radius_meters = float(payload.get("radiusMeters", 100.0))

    if not category or latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="Category, latitude and longitude are required for duplicate checks.")

    try:
        complaint_category = ComplaintCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category.")

    try:
        latitude_val = float(latitude)
        longitude_val = float(longitude)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Latitude and longitude must be numeric values.")

    nearby = await _find_nearby_complaints(complaint_category.value, latitude_val, longitude_val, radius_meters)
    nearby_payload = []
    for complaint in nearby:
        payload = format_complaint_dict(complaint)
        payload["distanceMeters"] = complaint.get("distanceMeters", 0.0)
        payload["upvotes"] = int(complaint.get("upvotes", 0))
        nearby_payload.append(payload)
    existing_payload = nearby_payload[0] if nearby_payload else None
    distance_meters = nearby_payload[0]["distanceMeters"] if nearby_payload else 0.0

    return {
        "success": True,
        "duplicate": bool(nearby_payload),
        "distanceMeters": distance_meters,
        "message": "Similar issues have already been reported near this location." if nearby_payload else "No nearby duplicate complaint found.",
        "existingComplaint": existing_payload,
        "nearbyComplaints": nearby_payload,
        "data": {
            "duplicate": bool(nearby_payload),
            "distanceMeters": distance_meters,
            "existingComplaint": existing_payload,
            "nearbyComplaints": nearby_payload,
        }
    }


@router.post("/{complaint_id}/upvote")
async def upvote_complaint(
    complaint_id: str,
    payload: Optional[dict] = None,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    db = get_db()
    anonymous_phone = _normalize_phone((payload or {}).get("phone"))
    if not user and len(anonymous_phone) < 8:
        raise HTTPException(status_code=400, detail="A phone number is required to upvote anonymously.")

    voter_id = user.get("_id") if user else None
    voter_field = "upvotedBy" if voter_id else "upvotedPhones"
    voter_value = voter_id or anonymous_phone
    id_filter = {"complaintId": complaint_id}
    if ObjectId.is_valid(complaint_id):
        id_filter = {"$or": [{"complaintId": complaint_id}, {"_id": ObjectId(complaint_id)}]}

    result = await db.complaints.update_one(
        {**id_filter, voter_field: {"$ne": voter_value}},
        {"$addToSet": {voter_field: voter_value}, "$inc": {"upvotes": 1}},
    )
    if result.matched_count == 0:
        complaint = await db.complaints.find_one(id_filter)
        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found.")
        return {"success": True, "upvotes": int(complaint.get("upvotes", 0)), "alreadyUpvoted": True}

    complaint = await db.complaints.find_one(id_filter)
    return {"success": True, "upvotes": int(complaint.get("upvotes", 0)), "alreadyUpvoted": False}


@router.get("/track")
@router.get("/track/{complaint_id}")
async def track_complaint_public(complaint_id: Optional[str] = None, complaintId: Optional[str] = None):
    raw_param = complaint_id or complaintId or ""
    if not raw_param or not raw_param.strip():
        raise HTTPException(status_code=400, detail="Complaint ID reference number is required.")

    clean_id = re.sub(r'^[#\s]+', '', raw_param.strip())
    clean_id = re.sub(r'^(ref|no|id)[\s:#-]*', '', clean_id, flags=re.IGNORECASE).strip()

    if clean_id.isdigit():
        clean_id = f"CIV-{clean_id}"

    escaped = re.escape(clean_id)
    regex = f"^{escaped}$"

    db = get_db()
    complaint = await db.complaints.find_one({"complaintId": {"$regex": regex, "$options": "i"}})

    if not complaint and ObjectId.is_valid(raw_param.strip()):
        complaint = await db.complaints.find_one({"_id": ObjectId(raw_param.strip())})

    if not complaint:
        raise HTTPException(status_code=404, detail="No complaint found matching this reference ID.")

    formatted_c = {
        "complaintId": complaint.get("complaintId"),
        "category": complaint.get("category"),
        "status": complaint.get("status"),
        "department": complaint.get("department"),
        "createdAt": complaint.get("createdAt").isoformat() if complaint.get("createdAt") else None,
        "updatedAt": complaint.get("updatedAt").isoformat() if complaint.get("updatedAt") else None,
    }
    return {
        "success": True,
        "complaint": formatted_c,
        "data": {"complaint": formatted_c}
    }


@router.post("")
@router.post("/")
async def create_complaint(
    request: Request,
    category: str = Form(...),
    description: str = Form(...),
    latitude: str = Form(...),
    longitude: str = Form(...),
    address: str = Form(...),
    files: List[UploadFile] = File(None),
    reporterName: Optional[str] = Form(None),
    reporterPhone: Optional[str] = Form(None),
    isAnonymous: Optional[str] = Form("false"),
    evidenceSource: Optional[str] = Form("camera"),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    try:
        complaint_category = ComplaintCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category.")

    anonymous_flag = str(isAnonymous).lower() in {"true", "1", "yes", "y"}
    if not user and not anonymous_flag:
        raise HTTPException(status_code=401, detail="Authentication required unless you are reporting anonymously.")

    normalized_reporter_phone = _normalize_phone(reporterPhone)
    if anonymous_flag and len(normalized_reporter_phone) < 8:
        raise HTTPException(status_code=400, detail="A phone number is required for anonymous reports.")

    db = get_db()
    now = datetime.now(timezone.utc)
    rate_limit_key = user.get("_id") if user else (normalized_reporter_phone or (request.client.host if request.client else "unknown"))
    recent_submissions = await db.complaints.count_documents({
        "submissionRateKey": rate_limit_key,
        "createdAt": {"$gte": now.replace(microsecond=0) - timedelta(hours=1)},
    })
    if recent_submissions >= MAX_SUBMISSIONS_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail="Too many reports submitted recently. Please wait before submitting another report.",
        )

    try:
        latitude_value = float(latitude)
        longitude_value = float(longitude)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Latitude and longitude must be numeric values.")

    # Note: Nearby duplicate check is informational only (performed client-side at Step 3).
    # Users are shown existing nearby complaints and can still choose to file their own report.

    images = []
    image_paths = []
    evidence_hashes = []
    image_metadata = []
    voice_note = None

    if files:
        if len(files) > 5:
            raise HTTPException(status_code=400, detail="A maximum of five evidence files is allowed.")
        for file in files:
            if not file.filename:
                continue
            try:
                if file.content_type and file.content_type.startswith("audio/"):
                    if voice_note:
                        raise HTTPException(status_code=400, detail="Only one voice note is allowed.")
                    filename, _ = await save_upload_file(file, "audio")
                    voice_note = filename
                else:
                    file_bytes = await file.read()
                    file.file.seek(0)
                    evidence_hashes.append(sha256(file_bytes).hexdigest())
                    image_metadata.append(_extract_image_metadata(file_bytes))
                    filename, target_path = await save_upload_file(file, "image")
                    images.append(filename)
                    image_paths.append(target_path)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required as evidence.")

    if evidenceSource == "gallery":
        missing_provenance = [
            metadata for metadata in image_metadata
            if not metadata.get("gps") or not metadata.get("capturedAt")
        ]
        if missing_provenance:
            raise HTTPException(
                status_code=422,
                detail="Gallery images must contain original GPS and capture-time metadata. Use a live camera photo or upload the original image from the device.",
            )

    duplicate_evidence = await db.complaints.find_one({
        "evidenceHashes": {"$in": evidence_hashes},
    }) if evidence_hashes else None
    if duplicate_evidence:
        raise HTTPException(
            status_code=409,
            detail="This exact image was already used in another complaint and cannot be reused as evidence.",
        )

    review_flags = []
    metadata_checks = []
    for metadata in image_metadata:
        if metadata.get("gps"):
            gps_distance = _haversine_meters(
                latitude_value,
                longitude_value,
                metadata["gps"]["latitude"],
                metadata["gps"]["longitude"],
            )
            metadata_checks.append({"gpsDistanceMeters": round(gps_distance, 2)})
            if gps_distance > GPS_MISMATCH_METERS:
                review_flags.append("IMAGE_GPS_MISMATCH")
        if metadata.get("capturedAt"):
            captured_at = metadata["capturedAt"]
            age_days = (now - captured_at).total_seconds() / 86400
            metadata_checks.append({"captureAgeDays": round(age_days, 2)})
            if age_days < -0.01:
                review_flags.append("IMAGE_TIMESTAMP_IN_FUTURE")
            elif age_days > MAX_CAPTURE_AGE_DAYS:
                review_flags.append("IMAGE_TIMESTAMP_TOO_OLD")

    review_flags = sorted(set(review_flags))
    stored_image_metadata = []
    for metadata in image_metadata:
        stored_metadata = dict(metadata)
        if stored_metadata.get("capturedAt"):
            stored_metadata["capturedAt"] = stored_metadata["capturedAt"].isoformat()
        stored_image_metadata.append(stored_metadata)

    # 1. AI Vision Analysis on primary evidence
    ai_result = None
    if image_paths:
        try:
            ai_result = await analyze_image(image_paths[0])
        except Exception as ai_exc:
            print(f"AI image analysis error: {ai_exc}")

    ai_category = ai_result.get("category") if ai_result else None
    ai_mapped_category = ai_result.get("mappedCategory") if ai_result else None
    ai_confidence = float(ai_result.get("confidence", 0.0)) if ai_result else 0.0
    ai_verified = bool(ai_result.get("verified", False)) if ai_result else False
    ai_bounding_box = ai_result.get("boundingBox") if ai_result else None
    ai_message = ai_result.get("message") if ai_result else None

    if ai_confidence >= 0.9 or ai_mapped_category in ["water_issue", "drainage"]:
        ai_severity = "HIGH" if ai_confidence < 0.95 else "CRITICAL"
    elif ai_confidence >= 0.7:
        ai_severity = "MEDIUM"
    else:
        ai_severity = "LOW"

    if not ai_verified and not anonymous_flag:
        review_flags.append("AI_UNVERIFIED")

    department = get_department(complaint_category)
    priority_enum = get_priority_with_ai(complaint_category, ai_confidence, 0)
    priority = priority_enum.value

    # 2. Detect Delhi district from address and coordinates
    detected_district = await detect_district_from_address(address)
    district_id = detected_district.get("id", "central_delhi") if detected_district else "central_delhi"
    district_name = detected_district.get("name", "Central Delhi") if detected_district else "Central Delhi"

    # 3. SLA target calculation
    sla_hours, sla_deadline = calculate_sla(complaint_category, now)

    # 4. Suspicious evaluation
    citizen_id_str = str(user["_id"]) if user else ""
    is_suspicious, suspicious_reasons, suspicious_score = await evaluate_complaint_suspicion(
        citizen_id=citizen_id_str,
        title=description[:50],
        description=description,
        lat=latitude_value,
        lng=longitude_value,
    )
    all_review_flags = sorted(set(review_flags + suspicious_reasons))
    initial_status = ComplaintStatus.UNDER_REVIEW.value if all_review_flags else ComplaintStatus.SUBMITTED.value

    user_name = user.get("name", (reporterName or "Citizen").strip()) if user else (reporterName or "Citizen").strip()
    user_role = user.get("role", "CITIZEN") if user else "CITIZEN"

    initial_history_entry = {
        "from_status": None,
        "to_status": initial_status,
        "changed_by": user["_id"] if user else None,
        "changed_by_role": user_role,
        "changed_by_name": user_name,
        "changed_at": now,
        "comment": "Complaint filed by citizen",
        "evidence": None,
    }

    complaint_doc = {
        "citizenId": user["_id"] if user else None,
        "category": complaint_category.value,
        "status": initial_status,
        "description": description,
        "images": images,
        "evidenceHashes": evidence_hashes,
        "needsReview": bool(all_review_flags),
        "reviewFlags": all_review_flags,
        "isSuspicious": is_suspicious,
        "suspiciousReasons": suspicious_reasons,
        "suspiciousScore": suspicious_score,
        "imageMetadata": stored_image_metadata,
        "metadataChecks": metadata_checks,
        "submissionRateKey": rate_limit_key,
        "voiceNote": voice_note,
        "latitude": latitude_value,
        "longitude": longitude_value,
        "address": address,
        "district_id": district_id,
        "district_name": district_name,
        "department": department,
        "priority": priority,
        "aiCategory": ai_category,
        "aiMappedCategory": ai_mapped_category,
        "aiConfidence": ai_confidence,
        "aiSeverity": ai_severity,
        "aiVerified": ai_verified,
        "aiBoundingBox": ai_bounding_box,
        "aiMessage": ai_message,
        "slaHours": sla_hours,
        "slaDeadline": sla_deadline,
        "slaStatus": "ON_TRACK",
        "status_history": [initial_history_entry],
        "timeline": [{
            "status": initial_status,
            "timestamp": now,
            "note": "Complaint submitted",
        }],
        "isAnonymous": anonymous_flag,
        "reporterName": (reporterName or "Anonymous").strip() if anonymous_flag else "",
        "reporterPhone": normalized_reporter_phone if anonymous_flag else "",
        "createdAt": now,
        "updatedAt": now,
    }

    inserted = False
    for _ in range(5):
        try:
            complaint_id_str = await get_next_complaint_id()
            complaint_doc["complaintId"] = complaint_id_str
            result = await db.complaints.insert_one(complaint_doc)
            complaint_doc["_id"] = result.inserted_id
            inserted = True
            break
        except DuplicateKeyError:
            continue

    if not inserted:
        raise HTTPException(status_code=500, detail="Failed to allocate unique complaint ID. Please try again.")

    formatted_new = format_complaint_dict(complaint_doc)
    return {
        "success": True,
        "message": "Complaint submitted successfully",
        "complaint": formatted_new,
        "data": {"complaint": formatted_new}
    }


@router.post("/{complaint_id}/status")
async def update_complaint_status_endpoint(
    complaint_id: str,
    payload: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """
    Unified status transition endpoint.
    Handles Citizen verification/reopen, Worker progress/resolve, and Admin actions.
    """
    new_status_str = payload.get("status")
    comment = payload.get("comment")
    evidence = payload.get("evidence")
    worker_id = payload.get("worker_id")
    worker_name = payload.get("worker_name")

    if not new_status_str:
        raise HTTPException(status_code=400, detail="Missing status field")

    try:
        new_status = ComplaintStatus(new_status_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status '{new_status_str}'")

    updated = await transition_complaint_status(
        complaint_id=complaint_id,
        new_status=new_status,
        current_user=user,
        comment=comment,
        evidence=evidence,
        assigned_worker_id=worker_id,
        assigned_worker_name=worker_name,
    )

    return {
        "success": True,
        "message": f"Complaint status transitioned to {new_status_str}",
        "complaint": updated,
        "data": {"complaint": updated},
    }


@router.get("/my")
async def get_my_complaints(user: dict = Depends(get_current_user)):
    db = get_db()
    user_phone = _normalize_phone(user.get("phone"))
    ownership_filters = [{"citizenId": user["_id"]}]
    if user_phone:
        ownership_filters.append({"isAnonymous": True, "reporterPhone": user_phone})

    cursor = db.complaints.find({"$or": ownership_filters}).sort("createdAt", -1)

    complaints = await cursor.to_list(None)
    formatted_complaints = [format_complaint_dict(c) for c in complaints]

    return {
        "success": True,
        "complaints": formatted_complaints,
        "data": {"complaints": formatted_complaints}
    }


@router.get("/{id}")
async def get_complaint_by_id(id: str, user: dict = Depends(get_current_user)):
    id_filter = {"complaintId": id}
    if ObjectId.is_valid(id):
        id_filter = {"$or": [{"complaintId": id}, {"_id": ObjectId(id)}]}

    db = get_db()
    complaint = await db.complaints.find_one(id_filter)

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    user_role = user.get("role", "CITIZEN")
    allowed = False

    if user_role == "SUPER_ADMIN":
        allowed = True
    elif user_role == "ZONAL_ADMIN":
        user_district = (user.get("district_id") or "").lower()
        comp_district = (complaint.get("district_id") or "").lower()
        allowed = (not user_district) or (user_district == comp_district)
    elif user_role == "WORKER":
        allowed = str(complaint.get("assignedWorkerId") or "") == str(user.get("_id") or "")
    else:
        # Citizen
        allowed = complaint.get("citizenId") == user["_id"]
        if not allowed and complaint.get("isAnonymous"):
            allowed = bool(
                _normalize_phone(complaint.get("reporterPhone"))
                and _normalize_phone(complaint.get("reporterPhone")) == _normalize_phone(user.get("phone"))
            )

    if not allowed:
        raise HTTPException(status_code=403, detail="Access denied. You do not have permission to view this complaint.")

    formatted_found = format_complaint_dict(complaint)
    return {
        "success": True,
        "complaint": formatted_found,
        "data": {"complaint": formatted_found}
    }
