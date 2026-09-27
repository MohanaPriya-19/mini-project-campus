import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS, CATEGORIES } from '../constants/config'

const MAX_DESC_LENGTH = 1000
const LOCATION_TOTAL_TIMEOUT_MS = 30000
const LOCATION_READING_TIMEOUT_MS = 10000
const LOCATION_READING_COUNT = 3
// Indoor GPS is often less precise than outdoor GPS.  150 m is still small
// enough for the server-side campus boundary check, without rejecting normal
// readings from a phone inside a building.
const GPS_MAX_ACCURACY_METERS = 75
const GPS_MAX_USABLE_ACCURACY_METERS = 120

// AI confidence levels returned by backend
const AI_LEVEL = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
}

function distanceBetween(a, b) {
  const toRadians = (value) => value * Math.PI / 180
  const earthRadius = 6371000
  const dLat = toRadians(b.coords.latitude - a.coords.latitude)
  const dLng = toRadians(b.coords.longitude - a.coords.longitude)
  const lat1 = toRadians(a.coords.latitude)
  const lat2 = toRadians(b.coords.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

async function readCurrentPosition(timeoutMs) {
  let timeoutId
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function getPrecisePosition() {
  const readings = []
  const startedAt = Date.now()

  // A fresh last-known location lets a phone recover quickly after a brief GPS
  // dropout, but it is never used when marked mocked or too imprecise.
  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 2 * 60 * 1000,
    requiredAccuracy: GPS_MAX_USABLE_ACCURACY_METERS,
  })
  if (lastKnown && !lastKnown.mocked && Number.isFinite(lastKnown.coords.accuracy)) readings.push(lastKnown)

  while (readings.length < LOCATION_READING_COUNT && Date.now() - startedAt < LOCATION_TOTAL_TIMEOUT_MS) {
    const remaining = LOCATION_TOTAL_TIMEOUT_MS - (Date.now() - startedAt)
    try {
      const position = await readCurrentPosition(Math.min(LOCATION_READING_TIMEOUT_MS, remaining))
      if (!position.mocked && Number.isFinite(position.coords.accuracy)) readings.push(position)
    } catch (error) {
      if (error.message !== 'LOCATION_TIMEOUT') throw error
      // A timed-out sample is normal indoors; retain any other good samples.
      if (!readings.length && Date.now() - startedAt >= LOCATION_TOTAL_TIMEOUT_MS) throw error
    }
  }

  const usable = readings.filter((position) => position.coords.accuracy <= GPS_MAX_USABLE_ACCURACY_METERS)
  if (!usable.length) throw new Error('GPS_ACCURACY_UNAVAILABLE')

  // Prefer the tightest cluster rather than a single outlying coordinate.
  // The chosen coordinate is still sent to the server, which independently
  // calculates the distance to the PSG campus boundary.
  const clustered = usable.map((candidate) => ({
    candidate,
    group: usable.filter((other) => distanceBetween(candidate, other) <= Math.max(100, candidate.coords.accuracy * 2)),
  })).sort((a, b) => b.group.length - a.group.length || a.candidate.coords.accuracy - b.candidate.coords.accuracy)

  return clustered[0].group.sort((a, b) => a.coords.accuracy - b.coords.accuracy)[0]
}

export default function ReportComplaintScreen({ navigation }) {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [locationDescription, setLocationDescription] = useState('')
  const [image, setImage] = useState(null)
  const [location, setLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const [aiValidation, setAiValidation] = useState(null) // { level, reason, flaggedForReview }
  const [aiChecking, setAiChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  // ── Image ──────────────────────────────────────────────────────────────────

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to capture a complaint image.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0]
      setImage({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `complaint_${Date.now()}.jpg`,
        campusVerifiedAt: location.verifiedAt,
      })
      setAiValidation(null) // reset AI result when image changes
      setErrors((e) => ({ ...e, image: null }))
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required to select an image.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0]
      setImage({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `complaint_${Date.now()}.jpg`,
        campusVerifiedAt: location.verifiedAt,
      })
      setAiValidation(null)
      setErrors((e) => ({ ...e, image: null }))
    }
  }

  function showImageOptions() {
    if (!location?.verified) {
      Alert.alert(
        'Verify Campus Location First',
        'Verify your current PSG College of Technology campus location before taking or selecting a complaint photo.'
      )
      return
    }
    Alert.alert('Add Image', 'Choose an option', [
      { text: 'Take Photo', onPress: pickFromCamera },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  // ── AI pre-validation ──────────────────────────────────────────────────────

  async function runAiValidation() {
    if (!image || !description.trim() || !category) return
    setAiChecking(true)
    setAiValidation(null)
    try {
      const formData = new FormData()
      formData.append('image', { uri: image.uri, type: image.type, name: image.name })
      formData.append('description', description.trim())
      formData.append('category', category)
      const res = await api.post('/api/uploads/validate-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Qwen can take time to load on the first request. This override is
        // only for image verification; normal API calls retain their timeout.
        timeout: 125000,
      })
      setAiValidation(res.data.validation)
    } catch (err) {
      setAiValidation({
        valid: false,
        level: 'UNAVAILABLE',
        status: 'UNAVAILABLE',
        reason: err.message === 'Unable to connect to the server. Please check your internet connection.'
          ? 'Unable to connect to the complaint server.'
          : err.message || 'Image relevance could not be checked right now. Please try again.',
        flaggedForReview: true,
      })
    } finally {
      setAiChecking(false)
    }
  }

  // ── Location ───────────────────────────────────────────────────────────────

  async function captureLocation() {
    setLocationLoading(true)
    setLocationStatus('Checking location services...')
    setErrors((e) => ({ ...e, location: null }))
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        throw new Error('LOCATION_PERMISSION_DENIED')
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync()
      if (!servicesEnabled) throw new Error('LOCATION_SERVICES_DISABLED')
      const provider = await Location.getProviderStatusAsync()
      if (provider.gpsAvailable === false && provider.networkAvailable === false && provider.passiveAvailable === false) {
        throw new Error('LOCATION_PROVIDER_UNAVAILABLE')
      }
      setLocationStatus('Getting a precise GPS reading...')
      const pos = await getPrecisePosition()
      if (pos.mocked) {
        throw new Error('MOCK_LOCATION_DETECTED')
      }
      const { latitude, longitude, accuracy } = pos.coords
      if (accuracy > GPS_MAX_ACCURACY_METERS) throw new Error('GPS_ACCURACY_LOW')
      setLocationStatus('Verifying PSG campus boundary...')
      const res = await api.post('/api/location/verify', { latitude, longitude, accuracy })
      if (res.data.locationVerified) {
        setLocation({
          latitude, longitude, accuracy,
          distanceMeters: res.data.distanceMeters,
          allowedRadiusMeters: res.data.allowedRadiusMeters,
          verified: true, message: res.data.message, verifiedAt: Date.now(),
        })
      } else {
        setLocation({ latitude, longitude, accuracy, distanceMeters: res.data.distanceMeters, allowedRadiusMeters: res.data.allowedRadiusMeters, verified: false, message: res.data.message })
        setErrors((e) => ({ ...e, location: res.data.message }))
      }
    } catch (err) {
      const message = err.message === 'LOCATION_TIMEOUT'
        ? 'Location request timed out. Move to an open area and try again.'
        : err.message === 'LOCATION_PERMISSION_DENIED'
        ? 'Location permission is required to submit a complaint.'
        : err.message === 'LOCATION_SERVICES_DISABLED'
        ? 'Location services are turned off. Enable Location/GPS and try again.'
        : err.message === 'LOCATION_PROVIDER_UNAVAILABLE'
        ? 'No location provider is available. Enable GPS or Wi-Fi location and try again.'
        : err.message === 'MOCK_LOCATION_DETECTED'
        ? 'Mock locations are not accepted. Turn off mock location settings and try again.'
        : err.message === 'GPS_ACCURACY_LOW' || err.message === 'GPS_ACCURACY_UNAVAILABLE'
        ? 'GPS accuracy is too low. Move to an open area and try again.'
        : 'Unable to obtain your current location. Please enable location permission.'
      setLocation(null)
      setErrors((e) => ({ ...e, location: message }))
    } finally {
      setLocationStatus('')
      setLocationLoading(false)
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate() {
    const e = {}
    if (!category) e.category = 'Please select a category.'
    if (!description.trim()) e.description = 'Please enter a description.'
    else if (description.trim().length < 10) e.description = 'Description must be at least 10 characters.'
    if (!image) e.image = 'Please capture an image.'
    else if (!image.campusVerifiedAt) e.image = 'Verify campus location before adding the complaint photo.'
    if (!locationDescription.trim()) e.locationDescription = 'Please enter the campus block, floor, or nearby landmark.'
    if (!location) e.location = 'Please capture your current location.'
    else if (!location.verified) e.location = location.message || 'Location is not verified.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function doSubmit() {
    setSubmitting(true)
    try {
      const catRes = await api.get('/api/categories')
      const categories = catRes.data.categories || []
      const cat = categories.find((c) => c.name === category)
      if (!cat) throw new Error('Invalid category. Please try again.')

      const formData = new FormData()
      formData.append('categoryId', cat._id)
      formData.append('description', description.trim())
      formData.append('locationDescription', locationDescription.trim())
      formData.append('latitude', String(location.latitude))
      formData.append('longitude', String(location.longitude))
      formData.append('gpsAccuracy', String(location.accuracy))
      formData.append('image', { uri: image.uri, type: image.type, name: image.name })

      const res = await api.post('/api/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      Alert.alert(
        'Complaint Submitted Successfully',
        res.data.message || 'Your complaint has been submitted and is awaiting verification.',
        [{ text: 'OK', onPress: () => navigation.navigate('Complaints') }]
      )
    } catch (err) {
      Alert.alert(
        'Complaint Submission Failed',
        err.message || 'The complaint could not be submitted. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!validate()) {
      const reasons = []
      if (!category) reasons.push('Select an issue category.')
      if (!description.trim()) reasons.push('Enter a description.')
      else if (description.trim().length < 10) reasons.push('Description must be at least 10 characters.')
      if (!locationDescription.trim()) reasons.push('Enter the issue location or landmark.')
      if (!image) reasons.push('Add a photo of the issue.')
      else if (!image.campusVerifiedAt) reasons.push('Verify campus location before adding the complaint photo.')
      if (!location) reasons.push('Capture your current location.')
      else if (!location.verified) reasons.push(location.message || 'You are outside the permitted campus area.')

      Alert.alert(
        'Complaint Cannot Be Submitted',
        reasons.join('\n') || 'Please complete all required fields and try again.'
      )
      return
    }

    // If AI validation hasn't run yet and we have all inputs, run it first
    if (!aiValidation && image && description.trim() && category) {
      await runAiValidation()
      // After AI check, re-evaluate — if LOW confidence, warn before proceeding
      return
    }

    // If AI returned LOW confidence, confirm with user before submitting
    if (aiValidation?.level === AI_LEVEL.LOW) {
      Alert.alert(
        'Image Validation Failed',
        aiValidation.reason || 'The image does not appear to match the selected category or description. Please choose a clearer, relevant image.'
      )
      return
    }

    if (aiValidation?.status === 'UNAVAILABLE') {
      Alert.alert('Image Validation Unavailable', aiValidation.reason)
      return
    }

    await doSubmit()
  }

  // ── AI feedback banner ─────────────────────────────────────────────────────

  function AiBanner() {
    if (aiChecking) {
      return (
        <View style={styles.aiBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.aiBannerText}>Checking image relevance...</Text>
        </View>
      )
    }
    if (!aiValidation || !aiValidation.level) return null

    const config = {
      HIGH: { bg: '#f0fdf4', border: '#86efac', icon: 'checkmark-circle-outline', color: COLORS.success },
      MEDIUM: { bg: '#fffbeb', border: '#fde68a', icon: 'alert-circle-outline', color: '#92400e' },
      LOW: { bg: '#fef2f2', border: '#fecaca', icon: 'warning-outline', color: COLORS.error },
      UNAVAILABLE: { bg: '#f8fafc', border: COLORS.border, icon: 'information-circle-outline', color: COLORS.textSecondary },
    }
    const c = config[aiValidation.level] || config.MEDIUM

    return (
      <View style={[styles.aiBanner, { backgroundColor: c.bg, borderColor: c.border }]}>
        <Ionicons name={c.icon} size={18} color={c.color} />
        <Text style={[styles.aiBannerText, { color: c.color, flex: 1 }]}>
          {aiValidation.status === 'VALID' ? 'Image Valid: ' : aiValidation.status === 'INVALID' ? 'Image Invalid: ' : ''}
          {aiValidation.reason}
        </Text>
      </View>
    )
  }

  const canRunAi = image && description.trim().length >= 10 && category && !aiChecking

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Category */}
      <Text style={styles.label}>Issue Category <Text style={styles.required}>*</Text></Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => { setCategory(cat); setAiValidation(null); setErrors((e) => ({ ...e, category: null })) }}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

      {/* Description */}
      <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.textArea, errors.description && styles.inputError]}
        placeholder="Describe the issue in detail..."
        placeholderTextColor={COLORS.textSecondary}
        value={description}
        onChangeText={(v) => { setDescription(v); setAiValidation(null); setErrors((e) => ({ ...e, description: null })) }}
        multiline
        numberOfLines={5}
        maxLength={MAX_DESC_LENGTH}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{description.length}/{MAX_DESC_LENGTH}</Text>
      {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}

      <Text style={styles.label}>Issue Location / Landmark <Text style={styles.required}>*</Text></Text>
      <Text style={styles.hint}>For example: K Block, Ground Floor near the washroom.</Text>
      <TextInput
        style={[styles.locationInput, errors.locationDescription && styles.inputError]}
        placeholder="Enter block, floor, room, or landmark"
        placeholderTextColor={COLORS.textSecondary}
        value={locationDescription}
        onChangeText={(value) => { setLocationDescription(value); setErrors((e) => ({ ...e, locationDescription: null })) }}
        maxLength={200}
      />
      {errors.locationDescription ? <Text style={styles.errorText}>{errors.locationDescription}</Text> : null}

      {/* Image */}
      <Text style={styles.label}>Photo <Text style={styles.required}>*</Text></Text>
      <Text style={styles.hint}>First verify your campus location, then capture or select a photo of the issue.</Text>
      {image ? (
        <View style={styles.imagePreviewBox}>
          <Image source={{ uri: image.uri }} style={styles.imagePreview} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => { setImage(null); setAiValidation(null) }}>
            <Ionicons name="close-circle" size={28} color={COLORS.error} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.changeImageBtn} onPress={showImageOptions}>
            <Text style={styles.changeImageText}>Change Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.imagePicker, errors.image && styles.inputError]}
          onPress={showImageOptions}
        >
          <Ionicons name="camera-outline" size={32} color={COLORS.textSecondary} />
          <Text style={styles.imagePickerText}>Tap to add a photo</Text>
        </TouchableOpacity>
      )}
      {errors.image ? <Text style={styles.errorText}>{errors.image}</Text> : null}

      {/* AI Validation */}
      {image && (
        <View style={styles.aiSection}>
          <AiBanner />
          {canRunAi && !aiValidation && (
            <TouchableOpacity style={styles.aiCheckBtn} onPress={runAiValidation}>
              <Ionicons name="scan-outline" size={16} color={COLORS.primary} />
              <Text style={styles.aiCheckBtnText}>Check image relevance</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Location */}
      <Text style={styles.label}>Location <Text style={styles.required}>*</Text></Text>
      <Text style={styles.hint}>
        Your current location is required to confirm the complaint is reported from the PSG College of Technology campus.
      </Text>
      <TouchableOpacity
        style={[styles.locationBtn, location?.verified && styles.locationBtnVerified]}
        onPress={captureLocation}
        disabled={locationLoading}
      >
        {locationLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons
              name={location?.verified ? 'checkmark-circle' : 'location-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.locationBtnText}>
              {location?.verified
                ? 'Location Verified ✓'
                : location && !location.verified
                ? 'Retry Location'
                : 'Capture Current Location'}
            </Text>
          </>
        )}
      </TouchableOpacity>
      {locationLoading && locationStatus ? <Text style={styles.hint}>{locationStatus}</Text> : null}
      {location && (
        <Text style={location.verified ? styles.locationSuccess : styles.locationDebug}>
          {location.message}{'\n'}
          Location accuracy: {Math.round(location.accuracy)} m{location.distanceMeters != null ? ` · Distance from PSG campus: ${location.distanceMeters} m` : ''}
        </Text>
      )}
      {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}

      {/* Submit */}
      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting || aiChecking}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>
            {aiValidation ? 'Submit Complaint' : 'Validate & Submit'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.submitHint}>
        Your complaint will be reviewed by an administrator before a token ID is issued.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 6 },
  required: { color: COLORS.error },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.surface,
  },
  categoryChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  categoryChipText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  categoryChipTextActive: { color: '#fff' },
  textArea: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.surface, minHeight: 120,
  },
  locationInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface },
  inputError: { borderColor: COLORS.error },
  charCount: { textAlign: 'right', fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  imagePicker: {
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: 10, padding: 32, alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface,
  },
  imagePickerText: { color: COLORS.textSecondary, fontSize: 14 },
  imagePreviewBox: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  imagePreview: { width: '100%', height: 200, borderRadius: 10 },
  removeImageBtn: { position: 'absolute', top: 8, right: 8 },
  changeImageBtn: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, alignItems: 'center',
  },
  changeImageText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  aiSection: { marginTop: 8, gap: 8 },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  aiBannerText: { fontSize: 13, color: COLORS.textSecondary },
  aiCheckBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary,
  },
  aiCheckBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, justifyContent: 'center',
  },
  locationBtnVerified: { backgroundColor: COLORS.success },
  locationBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  locationSuccess: { color: COLORS.success, fontSize: 12, marginTop: 6, fontWeight: '600' },
  locationDebug: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 },
  submitBtn: {
    backgroundColor: COLORS.primary, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  submitHint: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 10 },
})
