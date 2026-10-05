const { verifyLocation } = require('../services/locationService')

// POST /api/location/verify
function verify(req, res) {
  const { latitude, longitude, accuracy } = req.body
  const lat = parseFloat(latitude)
  const lng = parseFloat(longitude)
  const options = req.user.role === 'staff'
    ? { maxAccuracyMeters: Number(process.env.STAFF_GPS_MAX_ACCURACY_METERS || 250) }
    : {}
  const result = verifyLocation(lat, lng, accuracy, options)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[LOCATION]', { latitude: lat, longitude: lng, accuracy, distanceFromPSG: result.distanceMeters, campusRadius: result.allowedRadiusMeters, inside: result.locationVerified })
  }
  res.json(result)
}

module.exports = { verify }
