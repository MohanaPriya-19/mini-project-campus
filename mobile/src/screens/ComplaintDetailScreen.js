import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS, COMPLAINT_STATUSES } from '../constants/config'
import { API_BASE_URL } from '../constants/config'

export default function ComplaintDetailScreen({ route }) {
  const { complaintId } = route.params
  const [complaint, setComplaint] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)

  async function fetchData() {
    try {
      setError(null)
      const [cRes, tRes] = await Promise.all([
        api.get(`/api/complaints/${complaintId}`),
        api.get(`/api/complaints/${complaintId}/timeline`),
      ])
      setComplaint(cRes.data.complaint)
      setTimeline(tRes.data.timeline || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [complaintId])

  function onRefresh() {
    setRefreshing(true)
    fetchData()
  }

  async function sendReminder() {
    setSendingReminder(true)
    try {
      const res = await api.post(`/api/complaints/${complaintId}/overdue-reminder`)
      setReminderSent(true)
      Alert.alert('Reminder Sent', res.data.message || 'Reminder sent to Admin and assigned staff.')
      fetchData()
    } catch (err) {
      Alert.alert('Reminder Not Sent', err.message || 'Unable to send the reminder. Please try again later.')
    } finally {
      setSendingReminder(false)
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  }

  if (error || !complaint) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Complaint not found.'}</Text>
      </View>
    )
  }

  const statusConfig = COMPLAINT_STATUSES[complaint.status] || { color: COLORS.border }
  const complaintPhoto = complaint.attachments?.find((a) => a.attachmentType === 'complaint_photo')
  const resolutionPhoto = complaint.attachments?.find((a) => a.attachmentType === 'resolution_photo')

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusConfig.color }]}>
        <Text style={styles.statusBannerText}>{complaint.status}</Text>
        {complaint.tokenId && <Text style={styles.tokenText}>Token: {complaint.tokenId}</Text>}
      </View>

      {complaint.status === 'Overdue' && (
        <View style={[styles.card, styles.reminderCard]}>
          <Text style={styles.reminderTitle}>This complaint is overdue</Text>
          <Text style={styles.reminderText}>Send a reminder to the assigned staff member and administrators.</Text>
          <TouchableOpacity
            style={[styles.reminderButton, (sendingReminder || reminderSent) && styles.reminderButtonDisabled]}
            disabled={sendingReminder || reminderSent}
            onPress={sendReminder}
          >
            <Ionicons name="notifications-outline" size={18} color="#fff" />
            <Text style={styles.reminderButtonText}>{reminderSent ? 'Reminder Sent' : sendingReminder ? 'Sending Reminder...' : 'Send Reminder'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Details */}
      <View style={styles.card}>
        <Row label="Category" value={complaint.categoryId?.name || '—'} />
        <Row label="Priority" value={complaint.priority || '—'} />
        <Row label="Submitted" value={new Date(complaint.createdAt).toLocaleString()} />
        {complaint.verifiedAt && <Row label="Verified" value={new Date(complaint.verifiedAt).toLocaleString()} />}
        {complaint.rejectionReason && <Row label="Rejection Reason" value={complaint.rejectionReason} highlight />}
        {complaint.isRepetitive && <Row label="Report type" value="Repetitive complaint — no separate token" />}
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{complaint.description}</Text>
      </View>

      {/* Complaint Photo */}
      {complaintPhoto && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Complaint Photo</Text>
          <Image
            source={{ uri: `${API_BASE_URL}${complaintPhoto.fileUrl}` }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Resolution Photo */}
      {resolutionPhoto && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resolution Proof</Text>
          <Image
            source={{ uri: `${API_BASE_URL}${resolutionPhoto.fileUrl}` }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Unable to Resolve */}
      {complaint.status === 'Unable to Resolve' && (
        <View style={[styles.card, styles.alertCard]}>
          <Ionicons name="warning-outline" size={20} color={COLORS.error} />
          <Text style={styles.alertTitle}>Unable to Resolve</Text>
          <Text style={styles.alertText}>
            Your complaint could not be resolved within the current assignment. The administrator has been notified.
          </Text>
        </View>
      )}

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        {timeline.map((entry, index) => (
          <View key={entry._id || index} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            {index < timeline.length - 1 && <View style={styles.timelineLine} />}
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStatus}>{entry.status}</Text>
              {entry.note ? <Text style={styles.timelineNote}>{entry.note}</Text> : null}
              <Text style={styles.timelineDate}>{new Date(entry.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {timeline.length === 0 && <Text style={styles.emptyText}>No timeline entries yet.</Text>}
      </View>
    </ScrollView>
  )
}

function Row({ label, value, highlight }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: COLORS.error, textAlign: 'center' },
  statusBanner: { borderRadius: 10, padding: 16, marginBottom: 12, alignItems: 'center' },
  statusBannerText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tokenText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.textSecondary, fontSize: 13 },
  rowValue: { color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  rowValueHighlight: { color: COLORS.error },
  description: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  photo: { width: '100%', height: 200, borderRadius: 8 },
  alertCard: { borderColor: '#fecaca', backgroundColor: '#fef2f2', gap: 6 },
  alertTitle: { fontWeight: '700', color: COLORS.error, fontSize: 14 },
  alertText: { color: '#991b1b', fontSize: 13, lineHeight: 20 },
  reminderCard: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  reminderTitle: { color: '#9a3412', fontWeight: '800', fontSize: 15 },
  reminderText: { color: '#9a3412', fontSize: 13, lineHeight: 19, marginTop: 4 },
  reminderButton: { backgroundColor: '#ea580c', borderRadius: 8, padding: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  reminderButtonDisabled: { opacity: 0.65 },
  reminderButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.primary, marginTop: 4, marginRight: 12, flexShrink: 0,
  },
  timelineLine: {
    position: 'absolute', left: 5, top: 16,
    width: 2, height: '100%', backgroundColor: COLORS.border,
  },
  timelineContent: { flex: 1 },
  timelineStatus: { fontWeight: '700', color: COLORS.text, fontSize: 14 },
  timelineNote: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  timelineDate: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
})
