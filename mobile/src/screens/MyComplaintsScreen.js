import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS, COMPLAINT_STATUSES } from '../constants/config'

export default function MyComplaintsScreen({ navigation }) {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  async function fetchComplaints() {
    try {
      setError(null)
      const res = await api.get('/api/complaints')
      setComplaints(res.data.complaints || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { fetchComplaints() }, []))

  function onRefresh() {
    setRefreshing(true)
    fetchComplaints()
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Complaints</Text>
        <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('ReportComplaint')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchComplaints}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        data={complaints}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={complaints.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Complaints Yet</Text>
            <Text style={styles.emptyText}>Tap the + button to report a campus issue.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusConfig = COMPLAINT_STATUSES[item.status] || { color: COLORS.border }
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ComplaintDetail', { complaintId: item._id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.category}>{item.categoryId?.name || 'Issue'}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusConfig.color }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
              <View style={styles.cardFooter}>
                {item.tokenId ? (
                  <Text style={styles.token}>Token: {item.tokenId}</Text>
                ) : (
                  <Text style={styles.noToken}>{item.isRepetitive ? 'Repetitive report · No token' : 'Awaiting verification'}</Text>
                )}
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              {item.priority && (
                <View style={[styles.priorityBadge, { backgroundColor: item.priority === 'High' ? '#fef2f2' : item.priority === 'Medium' ? '#fffbeb' : '#f0fdf4' }]}>
                  <Text style={[styles.priorityText, { color: item.priority === 'High' ? COLORS.error : item.priority === 'Medium' ? '#92400e' : COLORS.success }]}>
                    {item.priority} Priority
                  </Text>
                </View>
              )}
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
    paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  reportBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  errorBox: {
    margin: 16, padding: 12, backgroundColor: '#fef2f2',
    borderRadius: 8, borderWidth: 1, borderColor: '#fecaca',
    flexDirection: 'row', justifyContent: 'space-between',
  },
  errorText: { color: COLORS.error, flex: 1, fontSize: 13 },
  retryText: { color: COLORS.primary, fontWeight: '600' },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  category: { fontWeight: '700', color: COLORS.text, fontSize: 15 },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  description: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  token: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  noToken: { color: COLORS.textSecondary, fontSize: 12 },
  date: { color: COLORS.textSecondary, fontSize: 12 },
  priorityBadge: { marginTop: 6, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  priorityText: { fontSize: 11, fontWeight: '600' },
})
