import { useState } from 'react'
import exifr from 'exifr'

// Staff can't mark a task resolved without attaching proof — a photo
// showing the fix is actually done, AND that photo has to carry a real
// GPS geotag (from the phone/camera's EXIF data) proving it was actually
// taken on site, not pulled from a gallery or the internet. Admin can
// then see exactly what was checked before trusting the Resolved status.
export default function ResolveProofDialog({ title, onConfirm, onCancel }) {
  const [preview, setPreview] = useState(null)
  const [geo, setGeo] = useState(null) // { latitude, longitude } once verified
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [geoError, setGeoError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setGeoError('')
    setGeo(null)
    setPreview(null)

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    // Read the file for the preview thumbnail.
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)

    // Separately, check the file's actual EXIF data for a GPS geotag.
    // Only real camera photos with location services on will have this —
    // screenshots, downloaded images, and edited photos generally won't.
    setChecking(true)
    try {
      const gps = await exifr.gps(file)
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        setGeo(gps)
      } else {
        setGeoError('No location data found in this photo. Take a new photo with location/GPS tagging turned on in your camera app, and make sure you\'re not stripping location data when sharing it.')
      }
    } catch {
      setGeoError('Could not read location data from this photo — it may not be a camera-original file. Try taking a fresh photo instead.')
    } finally {
      setChecking(false)
    }
  }

  const canSubmit = Boolean(preview) && Boolean(geo) && !checking

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card">
        <h3>{title}</h3>
        <p>
          Attach a photo showing the issue is fixed. The photo must have GPS location data (taken on-site with your
          camera) — this is required before the complaint can be marked resolved.
        </p>

        <label className="field">
          <span>Resolution proof photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
        </label>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {preview && (
          <div className="proof-preview-wrap">
            <img src={preview} alt="Resolution proof preview" className="proof-preview" />
          </div>
        )}

        {checking && <div className="geo-status geo-status--checking">Checking photo for location data…</div>}

        {!checking && geo && (
          <div className="geo-status geo-status--ok">
            📍 Location verified — {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)}
          </div>
        )}

        {!checking && geoError && (
          <div className="geo-status geo-status--bad" role="alert">
            ⚠ {geoError}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onConfirm(preview, geo)} disabled={!canSubmit}>
            Mark resolved
          </button>
        </div>
      </div>
    </div>
  )
}
