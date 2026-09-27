import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { COLORS } from '../constants/config'

export default function LoginScreen() {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!identifier.trim()) e.identifier = 'Please enter your roll number.'
    if (!password) e.password = 'Please enter your password.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleLogin() {
    if (!validate()) return
    setLoading(true)
    try {
      await login(identifier.trim(), password)
    } catch (err) {
      Alert.alert('Login Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/psg-logo.jpg')} style={styles.logo} />
          </View>
          <Text style={styles.college}>PSG College of Technology</Text>
          <Text style={styles.appName}>Campus Grievance</Text>
          <Text style={styles.subtitle}>Student Portal</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <Text style={styles.label}>Roll Number</Text>
          <TextInput
            style={[styles.input, errors.identifier && styles.inputError]}
            placeholder="e.g. 21CS001"
            placeholderTextColor={COLORS.textSecondary}
            value={identifier}
            onChangeText={(v) => { setIdentifier(v); setErrors((e) => ({ ...e, identifier: null })) }}
            autoCapitalize="characters"
            returnKeyType="next"
          />
          {errors.identifier ? <Text style={styles.errorText}>{errors.identifier}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <View style={[styles.passwordRow, errors.password && styles.inputError]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })) }}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>PSG College of Technology, Coimbatore</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.primary },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  logo: { width: 72, height: 72, resizeMode: 'contain', borderRadius: 36 },
  college: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  appName: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },
  inputError: { borderColor: COLORS.error },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: COLORS.text },
  eyeBtn: { padding: 12 },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  loginBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, padding: 14,
    alignItems: 'center', marginTop: 24,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 12, marginTop: 24 },
})
