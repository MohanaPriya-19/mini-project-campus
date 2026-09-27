import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS } from '../constants/config'

export default function EventDetailScreen({ route }) {
  const { eventId } = route.params
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/api/events/${eventId}`)
      .then((res) => setEvent(res.data.event))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [eventId])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  if (error || !event) return <View style={styles.center}><Text style={styles.errorText}>{error || 'Event not found.'}</Text></View>

  const eventDate = new Date(event.date)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner */}
      <View style={styles.banner}>
        <Ionicons name="calendar" size={40} color="#fff" />
        <Text style={styles.bannerTitle}>{event.title}</Text>
        <Text style={styles.bannerType}>{event.eventType}</Text>
      </View>

      {/* Date & Time */}
      <View style={styles.card}>
        <InfoRow icon="calendar-outline" label="Date" value={eventDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
        {event.startTime && <InfoRow icon="time-outline" label="Time" value={`${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}`} />}
        {event.location && <InfoRow icon="location-outline" label="Location" value={event.location} />}
        {event.organizer && <InfoRow icon="person-outline" label="Organizer" value={event.organizer} />}
        {event.audience && <InfoRow icon="people-outline" label="Audience" value={event.audience} />}
        {event.maxParticipants && <InfoRow icon="people-circle-outline" label="Max Participants" value={String(event.maxParticipants)} />}
      </View>

      {/* Description */}
      {event.description && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About This Event</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>
      )}
    </ScrollView>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={COLORS.primary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: COLORS.error, textAlign: 'center' },
  banner: {
    backgroundColor: COLORS.primary, padding: 32,
    alignItems: 'center', gap: 8,
  },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  bannerType: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  card: {
    backgroundColor: COLORS.surface, margin: 16, marginBottom: 0,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIcon: { marginRight: 8, marginTop: 1 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 13, width: 100 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1 },
  description: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
})
