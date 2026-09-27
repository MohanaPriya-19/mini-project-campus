import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { COLORS } from '../constants/config'

const EVENT_ICONS = {
  'Awareness Campaign': 'megaphone-outline',
  'Tree Plantation': 'leaf-outline',
  'Sustainability Drive': 'earth-outline',
  'Cleanliness Drive': 'trash-outline',
  'Rally': 'people-outline',
  'Workshop': 'construct-outline',
  'Seminar': 'school-outline',
  'Environmental Program': 'flower-outline',
  'Other': 'calendar-outline',
}

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  async function fetchEvents() {
    try {
      setError(null)
      const res = await api.get('/api/events')
      setEvents(res.data.events || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { fetchEvents() }, []))

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campus Events</Text>
        <Text style={styles.headerSub}>Sustainability & Awareness</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchEvents}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        data={events}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents() }} colors={[COLORS.primary]} />}
        contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Events</Text>
            <Text style={styles.emptyText}>No upcoming events at the moment. Check back later.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = EVENT_ICONS[item.eventType] || 'calendar-outline'
          const eventDate = new Date(item.date)
          const isPast = eventDate < new Date()
          return (
            <TouchableOpacity
              style={[styles.card, isPast && styles.cardPast]}
              onPress={() => navigation.navigate('EventDetail', { eventId: item._id })}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name={icon} size={24} color={COLORS.primary} />
                </View>
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{eventDate.getDate()}</Text>
                  <Text style={styles.dateMonth}>{eventDate.toLocaleString('default', { month: 'short' })}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.eventType}>{item.eventType}</Text>
                {item.location && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.locationText}>{item.location}</Text>
                  </View>
                )}
                {item.startTime && (
                  <View style={styles.locationRow}>
                    <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.locationText}>{item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
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
    backgroundColor: COLORS.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cardPast: { opacity: 0.6 },
  cardLeft: { alignItems: 'center', gap: 4 },
  iconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  dateBox: { alignItems: 'center' },
  dateDay: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  dateMonth: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase' },
  cardBody: { flex: 1 },
  eventTitle: { fontWeight: '700', color: COLORS.text, fontSize: 14, marginBottom: 2 },
  eventType: { color: COLORS.primary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { color: COLORS.textSecondary, fontSize: 12 },
})
