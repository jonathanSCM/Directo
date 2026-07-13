import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Logo } from '../../src/components/Logo';
import { useAuth } from '../../src/context/AuthContext';

const BLUE = '#1D4ED8';

export default function LoginWeb() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Completa todos los campos'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={S.root}>
      {/* Left panel */}
      <View style={S.left}>
        <View style={S.watermark} pointerEvents="none">
          <Text style={S.watermarkText}>DIRECTO</Text>
        </View>
        <View style={S.leftInner}>
          <View style={S.logoRow}>
            <Logo size={40} variant="white" />
            <Text style={S.brand}>DIRECTO</Text>
          </View>
          <Text style={S.headline}>Bienvenido{'\n'}de vuelta.</Text>
          <Text style={S.desc}>
            Ingresa a tu cuenta para continuar buscando o publicando propiedades.
          </Text>
          <View style={S.trust}>
            {['Sin comisiones ocultas', 'Contacto directo', 'Más de 500 propiedades'].map(t => (
              <View key={t} style={S.trustItem}>
                <View style={S.trustDot} />
                <Text style={S.trustText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Right panel */}
      <View style={S.right}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          <View style={S.card}>
            {/* Header */}
            <View style={S.cardHeader}>
              <Logo size={32} variant="blue" />
              <Text style={S.cardTitle}>Iniciar sesión</Text>
              <Text style={S.cardSub}>Ingresa tus credenciales para continuar</Text>
            </View>

            {/* Error */}
            {!!error && (
              <View style={S.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={S.errorText}>{error}</Text>
              </View>
            )}

            {/* Form */}
            <View style={S.form}>
              <View style={S.field}>
                <Text style={S.label}>Email</Text>
                <View style={S.inputRow}>
                  <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={S.input}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onSubmitEditing={handleLogin}
                  />
                </View>
              </View>

              <View style={S.field}>
                <Text style={S.label}>Contraseña</Text>
                <View style={S.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={S.input}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPwd}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPwd(v => !v)}>
                    <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={S.forgotRow}>
                <Text style={S.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[S.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.btnText}>Iniciar sesión</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={S.divider}>
              <View style={S.line} />
              <Text style={S.divText}>o continúa con</Text>
              <View style={S.line} />
            </View>

            {/* Social */}
            <View style={S.social}>
              <TouchableOpacity style={S.socialBtn}>
                <Text style={S.googleG}>G</Text>
                <Text style={S.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.socialBtn}>
                <Ionicons name="logo-apple" size={20} color="#374151" />
                <Text style={S.socialText}>Apple</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={S.footer}>
              <Text style={S.footerText}>¿No tienes cuenta?{' '}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={S.footerLink}>Regístrate gratis</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },

  // Left
  left: { flex: 1, backgroundColor: BLUE, overflow: 'hidden' as any, position: 'relative' },
  watermark: { position: 'absolute', bottom: -60, right: -80, opacity: 0.07 },
  watermarkText: { fontSize: 180, fontWeight: '900' as any, color: '#fff', letterSpacing: -6, userSelect: 'none' as any },
  leftInner: { flex: 1, justifyContent: 'center', paddingHorizontal: 52, paddingVertical: 60 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 36 },
  brand: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headline: { fontSize: 42, fontWeight: '800', color: '#fff', lineHeight: 50, marginBottom: 18, letterSpacing: -1 },
  desc: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, maxWidth: 380, marginBottom: 40 },
  trust: { gap: 14 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  trustText: { fontSize: 15, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  // Right
  right: { width: 500, backgroundColor: '#F9FAFB', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 36,
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)' as any,
  },
  cardHeader: { alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 12, marginBottom: 6 },
  cardSub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { color: '#DC2626', fontSize: 13.5, flex: 1 },

  form: { gap: 16, marginBottom: 20 },
  field: { gap: 6 },
  label: { fontSize: 13.5, fontWeight: '600', color: '#374151' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, gap: 10, backgroundColor: '#FAFAFA',
  },
  input: { flex: 1, fontSize: 15, color: '#111827', outlineStyle: 'none' as any },

  forgotRow: { alignSelf: 'flex-end' },
  forgotText: { color: BLUE, fontSize: 13, fontWeight: '600' },

  btnPrimary: {
    backgroundColor: BLUE, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    cursor: 'pointer' as any,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  divText: { marginHorizontal: 12, color: '#9CA3AF', fontSize: 13 },

  social: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', cursor: 'pointer' as any,
  },
  googleG: { fontSize: 17, fontWeight: '700', color: '#374151' },
  socialText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#6B7280', fontSize: 14 },
  footerLink: { color: BLUE, fontWeight: '700', fontSize: 14 },
});
