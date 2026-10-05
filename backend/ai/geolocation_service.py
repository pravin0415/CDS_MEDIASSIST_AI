"""Geolocation Service for MediAssist AI.

Queries OpenStreetMap Overpass API for mapped hospitals or doctor/clinic
locations near specified GPS coordinates. Uses zero synthetic facility data.
"""

from math import atan2, cos, radians, sin, sqrt
import requests


# Public Overpass instances occasionally rate-limit or reject a specific IP.
# Try independent, public read-only instances in order; every response remains
# live OpenStreetMap data and no facility details are invented locally.
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
OVERPASS_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "MediAssist-AI/1.0 (academic clinical decision-support project)",
}


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the Great Circle distance (haversine) between two coordinates in km."""
    R = 6371.0  # Earth's radius in kilometers

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat / 2.0) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0) ** 2
    c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))

    return R * c


def get_nearby_doctors(lat: float, lon: float, radius_km: float = 3.0, limit: int = 10, kind: str = "hospital") -> dict:
    """Fetch mapped hospitals or doctor/clinic locations within a bounded radius.

    Args:
        lat: Latitude float
        lon: Longitude float
        radius_km: Search radius in kilometers (default 3.0, capped at 5.0).
                   The UI only requests 5 km after an explicit patient action.
        limit: Maximum number of facilities to return

    Returns:
        dict: {
            "query_location": {"lat": lat, "lon": lon, "radius_km": radius_km},
            "total_found": int,
            "facilities": list[dict],
        }
    """
    # Never silently expand: the UI makes the patient choose 5 km explicitly.
    radius_km = min(max(float(radius_km), 0.5), 5.0)
    radius_m = int(radius_km * 1000)

    if kind not in {"hospital", "doctor"}:
        raise ValueError("kind must be hospital or doctor")

    # Urgent-hospital results remain strictly hospitals. Non-emergency doctor
    # search uses only doctor-office or clinic tags and labels them as mapped
    # places, not verified clinicians or appointments.
    matches = (
        [('amenity', 'hospital'), ('healthcare', 'hospital')]
        if kind == "hospital" else
        [('amenity', 'doctors'), ('healthcare', 'doctor'),
         ('amenity', 'clinic'), ('healthcare', 'clinic')]
    )
    selectors = "\n".join(
        f'      {osm_type}["{key}"="{value}"](around:{radius_m},{lat},{lon});'
        for key, value in matches
        for osm_type in ("node", "way", "relation")
    )
    query = f"""
    [out:json][timeout:10];
    (
{selectors}
    );
    out center;
    """

    errors = []
    elements = None
    for url in OVERPASS_URLS:
        try:
            response = requests.post(
                url,
                data={"data": query},
                headers=OVERPASS_HEADERS,
                timeout=12,
            )
            response.raise_for_status()
            # `requests.Response` exposes `.json()` (unlike Flask's response
            # object, which exposes `.get_json()`).
            elements = response.json().get("elements", [])
            break
        except (requests.RequestException, ValueError) as exc:
            errors.append(f"{url}: {exc}")

    if elements is None:
        return {
            "query_location": {"lat": lat, "lon": lon, "radius_km": radius_km},
            "error": "OpenStreetMap facility search is temporarily unavailable. "
                     "Please try again shortly.",
            "details": errors,
            "total_found": 0,
            "facilities": [],
        }

    facilities = []
    seen_names = set()

    for item in elements:
        tags = item.get("tags", {})
        if not any(tags.get(key) == value for key, value in matches):
            continue
        name = tags.get("name") or tags.get("name:en") or tags.get("official_name")
        
        # If no name, build descriptive fallback from amenity type
        amenity_type = "hospital" if kind == "hospital" else (
            "clinic" if tags.get("amenity") == "clinic" or tags.get("healthcare") == "clinic" else "doctor"
        )
        if not name:
            name = f"Medical {amenity_type.replace('_', ' ').title()}"

        # Deduplicate
        dedup_key = f"{name.lower()}_{item.get('id')}"
        if dedup_key in seen_names:
            continue
        seen_names.add(dedup_key)

        # Get coordinates
        if item.get("type") == "node":
            item_lat = item.get("lat")
            item_lon = item.get("lon")
        else:
            center = item.get("center", {})
            item_lat = center.get("lat")
            item_lon = center.get("lon")

        if item_lat is None or item_lon is None:
            continue

        distance_km = calculate_distance_km(lat, lon, item_lat, item_lon)
        if distance_km > radius_km:
            continue

        # Build address
        address_parts = [
            tags.get("addr:housenumber", ""),
            tags.get("addr:street", ""),
            tags.get("addr:suburb", "") or tags.get("addr:neighbourhood", ""),
            tags.get("addr:city", ""),
        ]
        full_address = ", ".join([p for p in address_parts if p]).strip() or tags.get("address", "Local address")

        facilities.append({
            "id": str(item.get("id")),
            "name": name,
            "type": amenity_type,
            "distance_km": round(distance_km, 2),
            "latitude": item_lat,
            "longitude": item_lon,
            "address": full_address,
            "phone": tags.get("phone") or tags.get("contact:phone") or "Not listed",
            "emergency": kind == "hospital" and tags.get("emergency") == "yes",
            "maps_url": f"https://www.google.com/maps/dir/?api=1&destination={item_lat},{item_lon}",
        })

    # Sort by distance
    facilities.sort(key=lambda x: x["distance_km"])

    return {
        "query_location": {"lat": lat, "lon": lon, "radius_km": radius_km},
        "total_found": len(facilities),
        "facilities": facilities[:limit],
    }
