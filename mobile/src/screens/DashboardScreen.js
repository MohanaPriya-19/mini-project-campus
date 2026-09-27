import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS, COMPLAINT_STATUSES } from '../constants/config'
import { useAuth } from '../context/AuthContext'

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  async function fetchDashboard() {
    try {
      setError(null)
      const res = await api.get('/api/students/dashboard')
      setData(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { fetchDashboard() }, []))

  useEffect(() => {
    const interval = setInterval(fetchDashboard, 60000)
    return () => clearInterval(interval)
  }, [])

  function onRefresh() {
    setRefreshing(true)
    fetchDashboard()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  const student = data?.student || user
  const recentComplaints = data?.recentComplaints || []
  const statusSummary = data?.statusSummary || {}
  const unread = data?.unreadNotifications || 0

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Image source={require('../../assets/psg-logo.jpg')} style={styles.headerLogo} />
        <View>
          <Text style={styles.welcome}>Welcome, {student?.name || 'Student'}</Text>
          <Text style={styles.name}>Campus Infrastructure Sustainability Reporter</Text>
          <Text style={styles.meta}>{student?.rollNumber} · {student?.department}</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Points */}
      {student?.points !== undefined && (
        <View style={styles.pointsCard}>
          <Ionicons name="star" size={20} color="#f59e0b" />
          <Text style={styles.pointsText}>{student.points} Points</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.leaderboardLink}>View Leaderboard →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report Button */}
      <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('ReportComplaint')}>
        <Ionicons name="add-circle-outline" size={24} color="#fff" />
        <Text style={styles.reportBtnText}>Report a Campus Issue</Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchDashboard}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status Summary */}
      {Object.keys(statusSummary).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Complaints Summary</Text>
          <View style={styles.summaryRow}>
            {Object.entries(statusSummary).map(([status, count]) => (
              <View key={status} style={[styles.summaryChip, { borderColor: COMPLAINT_STATUSES[status]?.color || COLORS.border }]}>
                <Text style={[styles.summaryCount, { color: COMPLAINT_STATUSES[status]?.color || COLORS.text }]}>{count}</Text>
                <Text style={styles.summaryLabel}>{status}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent Complaints */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Complaints</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Complaints')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentComplaints.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No complaints yet. Tap above to report an issue.</Text>
          </View>
        ) : (
          recentComplaints.map((c) => (
            <TouchableOpacity
              key={c._id}
              style={styles.complaintCard}
              onPress={() => navigation.navigate('ComplaintDetail', { complaintId: c._id })}
            >
              <View style={styles.complaintRow}>
                <Text style={styles.complaintCategory}>{c.categoryId?.name || 'Issue'}</Text>
                <View style={[styles.statusPill, { backgroundColor: COMPLAINT_STATUSES[c.status]?.color || COLORS.border }]}>
                  <Text style={styles.statusPillText}>{c.status}</Text>
                </View>
              </View>
              <Text style={styles.complaintDesc} numberOfLines={2}>{c.description}</Text>
              {c.tokenId && <Text style={styles.tokenId}>Token: {c.tokenId}</Text>}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary, padding: 24, paddingTop: 56,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerLogo: { width: 46, height: 46, resizeMode: 'contain', backgroundColor: '#fff', borderRadius: 5, marginRight: 10 },
  welcome: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  meta: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  notifBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: COLORS.error, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pointsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', margin: 16, marginBottom: 0,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a',
  },
  pointsText: { flex: 1, color: '#92400e', fontWeight: '600' },
  leaderboardLink: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.secondary, margin: 16, padding: 16,
    borderRadius: 12, justifyContent: 'center',
  },
  reportBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: {
    margin: 16, padding: 12, backgroundColor: '#fef2f2',
    borderRadius: 8, borderWidth: 1, borderColor: '#fecaca',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { color: COLORS.error, flex: 1, fontSize: 13 },
  retryText: { color: COLORS.primary, fontWeight: '600', marginLeft: 8 },
  section: { margin: 16, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seeAll: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip: {
    borderWidth: 1.5, borderRadius: 8, padding: 8,
    alignItems: 'center', minWidth: 80,
  },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  emptyBox: { alignItems: 'center', padding: 24, gap: 8 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14 },
  complaintCard: {
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  complaintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  complaintCategory: { fontWeight: '700', color: COLORS.text, fontSize: 14 },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  complaintDesc: { color: COLORS.textSecondary, fontSize: 13 },
  tokenId: { color: COLORS.primary, fontSize: 12, fontWeight: '600', marginTop: 4 },
})
