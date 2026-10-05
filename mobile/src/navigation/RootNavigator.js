import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { View, ActivityIndicator } from 'react-native'

import { useAuth } from '../context/AuthContext'
import { COLORS } from '../constants/config'

import LoginScreen from '../screens/LoginScreen'
import DashboardScreen from '../screens/DashboardScreen'
import ReportComplaintScreen from '../screens/ReportComplaintScreen'
import MyComplaintsScreen from '../screens/MyComplaintsScreen'
import ComplaintDetailScreen from '../screens/ComplaintDetailScreen'
import EventsScreen from '../screens/EventsScreen'
import EventDetailScreen from '../screens/EventDetailScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import ProfileScreen from '../screens/ProfileScreen'

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home-outline',
            Complaints: 'document-text-outline',
            Events: 'calendar-outline',
            Notifications: 'notifications-outline',
            Profile: 'person-outline',
          }
          return <Ionicons name={icons[route.name]} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Complaints" component={MyComplaintsScreen} />
      <Tab.Screen name="Events" component={EventsScreen} options={{ title: 'Sustainability Events', tabBarLabel: 'Sustainability Events' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen name="ReportComplaint" component={ReportComplaintScreen} options={{ headerShown: true, title: 'Report Issue', headerTintColor: COLORS.primary }} />
      <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} options={{ headerShown: true, title: 'Complaint Details', headerTintColor: COLORS.primary }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: true, title: 'Sustainability Event Details', headerTintColor: COLORS.primary }} />
    </Stack.Navigator>
  )
}

export default function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App" component={AppStack} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
