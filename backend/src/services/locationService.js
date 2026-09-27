/**
 * Location verification service.
 * Supports two modes controlled by LOCATION_MODE env var:
 *   radius  — Haversine distance from campus center
 *   polygon — point-in-polygon ray casting (set CAMPUS_POLYGON_JSON)
 */

const CAMPUS_LAT = parseFloat(process.env.CAMPUS_LATITUDE || '11.0238')
const CAMPUS_LNG = parseFloat(process.env.CAMPUS_LONGITUDE || '77.0066')
const CAMPUS_RADIUS = parseFloat(process.env.CAMPUS_RADIUS_METERS || '800')
const MAX_GPS_ACCURACY = parseFloat(process.env.GPS_MAX_ACCURACY_METERS || '100')
const LOCATION_MODE = process.env.LOCATION_MODE || 'radius'

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Ray-casting algorithm for point-in-polygon
function pointInPolygon(lat, lng, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function verifyLocation(latitude, longitude, accuracy) {
  if (latitude == null || longitude == null) {
    return { locationVerified: false, message: 'Location coordinates are missing.' }
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { locationVerified: false, message: 'Invalid GPS coordinates.' }
  }

  const accuracyMeters = Number(accuracy)
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return { locationVerified: false, message: 'GPS accuracy is unavailable. Please move to an open area and try again.' }
  }

  let isInside = false
  let distanceMeters = null

  if (LOCATION_MODE === 'polygon') {
    try {
      const polygon = JSON.parse(process.env.CAMPUS_POLYGON_JSON || '[]')
      if (polygon.length < 3) throw new Error('Polygon too small')
      isInside = pointInPolygon(latitude, longitude, polygon)
    } catch {
      // Fall back to radius if polygon config is invalid
      distanceMeters = haversineDistance(CAMPUS_LAT, CAMPUS_LNG, latitude, longitude)
      isInside = distanceMeters <= CAMPUS_RADIUS
    }
  } else {
    distanceMeters = haversineDistance(CAMPUS_LAT, CAMPUS_LNG, latitude, longitude)
    isInside = distanceMeters <= CAMPUS_RADIUS
  }

  const roundedDistance = distanceMeters == null ? null : Math.round(distanceMeters)
  const result = {
    latitude,
    longitude,
    accuracyMeters: Math.round(accuracyMeters),
    distanceMeters: roundedDistance,
    allowedRadiusMeters: LOCATION_MODE === 'radius' ? CAMPUS_RADIUS : null,
  }

  if (accuracyMeters > MAX_GPS_ACCURACY) {
    return {
      ...result,
      locationVerified: false,
      message: 'GPS accuracy is too low. Please move to an open area and try again.',
    }
  }

  // A point close to the boundary may be inside the real campus but displaced
  // by the reported GPS uncertainty. The mobile app gathers several readings;
  // report this distinct state rather than incorrectly calling it outside.
  if (LOCATION_MODE === 'radius' && !isInside && distanceMeters <= CAMPUS_RADIUS + accuracyMeters) {
    return {
      ...result,
      locationVerified: false,
      message: 'Your GPS reading is close to the campus boundary. Please obtain a more precise location and try again.',
    }
  }

  if (isInside) {
    return {
      ...result,
      locationVerified: true,
      message: 'Location is inside the PSG College of Technology campus.',
    }
  }
  return {
    ...result,
    locationVerified: false,
    message: 'You are outside the PSG College of Technology campus.',
  }
}

module.exports = { verifyLocation, haversineDistance }
