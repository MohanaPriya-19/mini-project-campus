import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { COLORS } from '../constants/config'

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('profile') // 'profile' | 'leaderboard'

  useEffect(() => {
    Promise.all([
      api.get('/api/auth/me'),
      api.get('/api/leaderboard'),
    ])
      .then(([meRes, lbRes]) => {
        setProfile(meRes.data.user)
        setLeaderboard(lbRes.data.leaderboard || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function confirmLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>

  const displayUser = profile || user

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(displayUser?.name || 'S')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{displayUser?.name || 'Student'}</Text>
        <Text style={styles.roll}>{displayUser?.rollNumber}</Text>
        <Text style={styles.dept}>{displayUser?.department}</Text>
        {displayUser?.points !== undefined && (
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.pointsText}>{displayUser.points} Points</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'profile' && styles.tabActive]}
          onPress={() => setTab('profile')}
        >
          <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'leaderboard' && styles.tabActive]}
          onPress={() => setTab('leaderboard')}
        >
          <Text style={[styles.tabText, tab === 'leaderboard' && styles.tabTextActive]}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {tab === 'profile' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <InfoRow icon="person-outline" label="Name" value={displayUser?.name || '—'} />
            <InfoRow icon="card-outline" label="Roll Number" value={displayUser?.rollNumber || '—'} />
            <InfoRow icon="business-outline" label="Department" value={displayUser?.department || '—'} />
            {displayUser?.year && <InfoRow icon="school-outline" label="Year" value={`Year ${displayUser.year}`} />}
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item, i) => item._id || String(i)}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<Text style={styles.emptyText}>No leaderboard data yet.</Text>}
          renderItem={({ item, index }) => {
            const isMe = item.rollNumber === displayUser?.rollNumber
            const medals = ['🥇', '🥈', '🥉']
            return (
              <View style={[styles.lbRow, isMe && styles.lbRowMe]}>
                <Text style={styles.lbRank}>{medals[index] || `#${index + 1}`}</Text>
                <View style={styles.lbInfo}>
                  <Text style={[styles.lbName, isMe && styles.lbNameMe]}>{item.name}</Text>
                  <Text style={styles.lbMeta}>{item.rollNumber} · {item.department}</Text>
                </View>
                <View style={styles.lbPoints}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.lbPointsText}>{item.points}</Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary, paddingTop: 56, paddingBottom: 24,
    alignItems: 'center', gap: 4,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { color: '#fff', fontSize: 20, fontWeight: '800' },
  roll: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  dept: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 4,
  },
  pointsText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIcon: { marginRight: 10 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 13, width: 100 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#fecaca', justifyContent: 'center',
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontSize: 15 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', padding: 24 },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  lbRowMe: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  lbRank: { fontSize: 20, width: 32, textAlign: 'center' },
  lbInfo: { flex: 1 },
  lbName: { fontWeight: '700', color: COLORS.text, fontSize: 14 },
  lbNameMe: { color: COLORS.primary },
  lbMeta: { color: COLORS.textSecondary, fontSize: 12 },
  lbPoints: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lbPointsText: { fontWeight: '700', color: '#92400e', fontSize: 14 },
})
