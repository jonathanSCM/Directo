import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import api from '../../src/services/api';

const BLUE = '#1D4ED8';

export default function RegisterWeb() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const selectRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/zones');
        const unique = [...new Set<string>(data.map((z: any) => z.city))].sort();
        setCities(unique);
      } catch {
        setCities(['Santa Cruz de la Sierra', 'La Paz', 'Cochabamba']);
      }
    })();
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Nombre, email y contraseña son obligatorios'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (!terms) { setError('Debes aceptar los términos y condiciones'); return; }
    setLoading(true);
    setError('');
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        city: city || undefined,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg ?? 'No se pudo registrar');
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
          <Text style={S.tagline}>COMPRA · VENDE · SIN INTERMEDIARIOS</Text>
          <Text style={S.headline}>Únete a la{'\n'}comunidad.</Text>
          <Text style={S.desc}>
            Publica y busca propiedades sin pagar comisiones. Contacta directo con el propietario.
          </Text>
          <View style={S.stats}>
            {[{ n: '500+', l: 'Propiedades' }, { n: '0%', l: 'Comisión' }, { n: 'Gratis', l: 'Para siempre' }].map(({ n, l }) => (
              <View key={l} style={S.statItem}>
                <Text style={S.statNum}>{n}</Text>
                <Text style={S.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Right panel */}
      <View style={S.right}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          <View style={S.card}>
            <View style={S.cardHeader}>
              <Logo size={32} variant="blue" />
              <Text style={S.cardTitle}>Crear cuenta gratis</Text>
              <Text style={S.cardSub}>Rellena los datos para empezar</Text>
            </View>

            {!!error && (
              <View style={S.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={S.errorText}>{error}</Text>
              </View>
            )}

            <View style={S.form}>
              {/* Name */}
              <View style={S.field}>
                <Text style={S.label}>Nombre completo</Text>
                <View style={S.inputRow}>
                  <Ionicons name="person-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={S.input}
                    placeholder="Carla Méndez"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              </View>

              {/* Email */}
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
                  />
                </View>
              </View>

              {/* Phone + City row */}
              <View style={S.twoCol}>
                <View style={[S.field, { flex: 1 }]}>
                  <Text style={S.label}>Teléfono</Text>
                  <View style={S.inputRow}>
                    <Text style={S.boFlag}>BO</Text>
                    <TextInput
                      style={S.input}
                      placeholder="+591 700..."
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
                <View style={[S.field, { flex: 1 }]}>
                  <Text style={S.label}>Ciudad</Text>
                  <View style={S.inputRow}>
                    <Ionicons name="location-outline" size={18} color="#9CA3AF" />
                    {/* Native HTML select for web */}
                    <select
                      ref={selectRef}
                      value={city}
                      onChange={(e: any) => setCity(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: city ? '#111827' : '#9CA3AF',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                      } as any}
                    >
                      <option value="" disabled>Seleccionar</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                  </View>
                </View>
              </View>

              {/* Password */}
              <View style={S.field}>
                <Text style={S.label}>Contraseña</Text>
                <View style={S.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={S.input}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPwd}
                    onSubmitEditing={handleRegister}
                  />
                  <TouchableOpacity onPress={() => setShowPwd(v => !v)}>
                    <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms */}
              <TouchableOpacity style={S.termsRow} onPress={() => setTerms(v => !v)}>
                <View style={[S.checkbox, terms && S.checkboxActive]}>
                  {terms && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={S.termsText}>
                  Acepto los <Text style={S.termsLink}>Términos</Text> y la{' '}
                  <Text style={S.termsLink}>Política de Privacidad</Text> de DIRECTO.
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[S.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.btnText}>Crear cuenta</Text>
              }
            </TouchableOpacity>

            {/* Footer */}
            <View style={S.footer}>
              <Text style={S.footerText}>¿Ya tienes cuenta?{' '}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={S.footerLink}>Inicia sesión</Text>
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  brand: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 2.5, marginBottom: 18 },
  headline: { fontSize: 42, fontWeight: '800', color: '#fff', lineHeight: 50, marginBottom: 18, letterSpacing: -1 },
  desc: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, maxWidth: 380, marginBottom: 40 },
  stats: { flexDirection: 'row', gap: 36 },
  statItem: { gap: 4 },
  statNum: { fontSize: 28, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Right
  right: { width: 520, backgroundColor: '#F9FAFB', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 36,
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)' as any,
  },
  cardHeader: { alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 12, marginBottom: 6 },
  cardSub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { color: '#DC2626', fontSize: 13.5, flex: 1 },

  form: { gap: 14, marginBottom: 20 },
  twoCol: { flexDirection: 'row', gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 13.5, fontWeight: '600', color: '#374151' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, gap: 10, backgroundColor: '#FAFAFA',
  },
  input: { flex: 1, fontSize: 15, color: '#111827', outlineStyle: 'none' as any },
  boFlag: { fontSize: 12, fontWeight: '700', color: '#6B7280' },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: BLUE, borderColor: BLUE },
  termsText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },
  termsLink: { color: BLUE, fontWeight: '700' },

  btnPrimary: {
    backgroundColor: BLUE, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    cursor: 'pointer' as any,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#6B7280', fontSize: 14 },
  footerLink: { color: BLUE, fontWeight: '700', fontSize: 14 },
});
