"""
District detection and access validation service.
"""

import httpx
from typing import Optional, Dict, Any

from ..models.district import DELHI_DISTRICTS, DISTRICT_BY_ID, DISTRICT_NAMES


async def detect_district_from_address(address: str) -> Optional[Dict[str, str]]:
    """
    Match a district from an address string by keyword matching.
    Returns {"id": ..., "name": ...} or None.
    """
    if not address:
        return None

    addr_lower = address.lower()

    for district in DELHI_DISTRICTS:
        for keyword in district["keywords"]:
            if keyword in addr_lower:
                return {"id": district["id"], "name": district["name"]}

    # Fallback: check if "delhi" is in the address at all (assign to New Delhi)
    if "delhi" in addr_lower:
        return {"id": "new_delhi", "name": "New Delhi"}

    return None


async def detect_district_from_coordinates(latitude: float, longitude: float) -> Optional[Dict[str, str]]:
    """
    Use Nominatim reverse geocoding to determine the Delhi district
    from GPS coordinates. Falls back to keyword matching on address parts.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json",
                    "addressdetails": 1,
                    "zoom": 14,
                },
                headers={"User-Agent": "CivicPulse/1.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                addr = data.get("address", {})
                display = data.get("display_name", "")

                # Try state_district first (often "South Delhi", "North Delhi", etc.)
                state_district = addr.get("state_district", "")
                suburb = addr.get("suburb", "")
                county = addr.get("county", "")

                # Build a combined search string
                search_parts = " ".join([
                    state_district, suburb, county, display,
                    addr.get("city_district", ""),
                    addr.get("neighbourhood", ""),
                ]).lower()

                for district in DELHI_DISTRICTS:
                    for keyword in district["keywords"]:
                        if keyword in search_parts:
                            return {"id": district["id"], "name": district["name"]}

                # If address mentions Delhi but no specific district matched
                if "delhi" in search_parts:
                    return {"id": "new_delhi", "name": "New Delhi"}

    except Exception:
        pass  # Nominatim unavailable — fall through

    return None


async def detect_district(latitude: float, longitude: float, address: str = "") -> Dict[str, str]:
    """
    Primary entry point: detect district from coordinates first,
    fall back to address keyword matching, then default to New Delhi.
    """
    # Try coordinates-based detection (Nominatim)
    result = await detect_district_from_coordinates(latitude, longitude)
    if result:
        return result

    # Fall back to address-based keyword matching
    result = await detect_district_from_address(address)
    if result:
        return result

    # Ultimate fallback for Delhi-based system
    return {"id": "new_delhi", "name": "New Delhi"}


def validate_district_access(user: dict, district_id: str) -> bool:
    """
    Verify that a user has access to the specified district.
    Super Admins have access to all districts.
    Zonal Admins can only access their own district.
    """
    role = user.get("role", "CITIZEN")
    if role == "SUPER_ADMIN":
        return True
    if role == "ZONAL_ADMIN":
        return user.get("district_id") == district_id
    return False


def get_district_name(district_id: str) -> str:
    """Get display name for a district ID."""
    return DISTRICT_NAMES.get(district_id, district_id)
