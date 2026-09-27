import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS } from '../constants/config'

const TYPE_ICONS = {
  complaint_submitted: 'document-text-outline',
  complaint_verified: 'checkmark-circle-outline',
  complaint_rejected: 'close-circle-outline',
  token_generated: 'key-outline',
  staff_assigned: 'person-add-outline',
  status_changed: 'refresh-outline',
  complaint_overdue: 'alarm-outline',
  unable_to_resolve: 'warning-outline',
  deadline_extended: 'time-outline',
  complaint_reassigned: 'swap-horizontal-outline',
  complaint_resolved: 'checkmark-done-outline',
  overdue_reminder: 'notifications-outline',
  repetitive_complaint: 'git-compare-outline',
  resolution_proof_uploaded: 'image-outline',
  event_published: 'calendar-outline',
  event_updated: 'create-outline',
  event_cancelled: 'ban-outline',
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchNotifications() {
    try {
      const res = await api.get('/api/notifications')
      setNotifications(res.data.notifications || [])
      setUnreadCount(res.data.unreadCount || 0)
    } catch {
      // silent — show stale data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { fetchNotifications() }, []))

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  async function markRead(id) {
    await api.patch(`/api/notifications/${id}/read`).catch(() => {})
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  async function markAllRead() {
    await api.patch('/api/notifications/read-all').catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.unreadBadge}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications() }} colors={[COLORS.primary]} />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = TYPE_ICONS[item.type] || 'notifications-outline'
          return (
            <TouchableOpacity
              style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
              onPress={() => {
                if (!item.isRead) markRead(item._id)
                if (item.complaintId) navigation.navigate('ComplaintDetail', { complaintId: item.complaintId })
              }}
            >
              <View style={[styles.iconBox, !item.isRead && styles.iconBoxUnread]}>
                <Ionicons name={icon} size={20} color={item.isRead ? COLORS.textSecondary : COLORS.primary} />
              </View>
              <View style={styles.notifBody}>
                <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>{item.title}</Text>
                <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.notifTime}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary, paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  unreadBadge: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  markAllBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  markAllText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyText: { color: COLORS.textSecondary },
  notifCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  notifCardUnread: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center',
  },
  iconBoxUnread: { backgroundColor: '#dbeafe' },
  notifBody: { flex: 1 },
  notifTitle: { fontWeight: '600', color: COLORS.text, fontSize: 14, marginBottom: 2 },
  notifTitleUnread: { fontWeight: '800', color: COLORS.primary },
  notifMessage: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  notifTime: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary, marginTop: 6,
  },
})
