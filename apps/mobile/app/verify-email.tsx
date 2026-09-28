import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Logo } from '../src/components/Logo';
import { useAuth } from '../src/context/AuthContext';
import { authService } from '../src/services/auth';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';

export default function VerifyEmail() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const email = params.email ?? user?.email ?? '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const autoSubmitted = useRef(false);

  const verify = async (codeToUse: string) => {
    if (!email || codeToUse.length !== 6) {
      setError('Ingresá el código de 6 dígitos que te mandamos por correo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.verifyEmail(email, codeToUse);
      await refreshUser();
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Código inválido o vencido. Pedí uno nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Llegó por el link del correo (deep link) con el código ya cargado —
  // se verifica solo, sin que el usuario toque nada.
  useEffect(() => {
    if (autoSubmitted.current) return;
    if (params.email && params.code && params.code.length === 6) {
      autoSubmitted.current = true;
      setCode(params.code);
      verify(params.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.email, params.code]);

  const resend = async () => {
    setResending(true);
    setResendMsg('');
    setError('');
    try {
      await authService.resendVerification();
      setResendMsg('Te mandamos un código nuevo — revisá tu correo.');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo reenviar el código, intentá de nuevo en un rato.');
    } finally {
      setResending(false);
    }
  };

  const skip = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoIcon}>
          <Logo size={40} variant="blue" />
        </View>

        {done ? (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            </View>
            <Text style={styles.title}>Correo verificado</Text>
            <Text style={styles.subtitle}>Ya podés publicar propiedades sin problema.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.primaryBtnText}>Continuar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Verificá tu correo</Text>
            <Text style={styles.subtitle}>
              Te mandamos un código de 6 dígitos a{email ? ` ${email}` : ' tu correo'}. Ingresalo acá abajo.
            </Text>

            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!resendMsg && <Text style={styles.successText}>{resendMsg}</Text>}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Código</Text>
              <View style={styles.inputRow}>
                <Ionicons name="keypad-outline" size={18} color={Colors.gray[400]} />
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="123456"
                  placeholderTextColor={Colors.gray[400]}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  onSubmitEditing={() => verify(code)}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={() => verify(code)}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Verificar</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={resend} disabled={resending} style={styles.linkBtn}>
              <Text style={styles.linkText}>{resending ? 'Enviando...' : 'Reenviar código'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={skip} style={styles.linkBtn}>
              <Text style={styles.skipText}>Ahora no</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: Spacing.xxl, paddingTop: 80, paddingBottom: 40 },
  logoIcon: { marginBottom: Spacing.lg, alignItems: 'center' },
  successIcon: { alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: Colors.gray[900], marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: Fonts.sizes.md, color: Colors.gray[500], marginBottom: Spacing.xxxl, lineHeight: 22, textAlign: 'center' },
  errorText: { color: '#DC2626', fontSize: Fonts.sizes.sm, marginBottom: Spacing.md, textAlign: 'center' },
  successText: { color: Colors.success, fontSize: Fonts.sizes.sm, marginBottom: Spacing.md, textAlign: 'center' },
  fieldGroup: { gap: 6, marginBottom: Spacing.lg },
  label: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    gap: 10, backgroundColor: Colors.white,
  },
  input: { flex: 1, fontSize: Fonts.sizes.md, color: Colors.gray[900], padding: 0 },
  codeInput: { fontSize: 22, fontWeight: '700', letterSpacing: 8 },
  primaryBtn: {
    backgroundColor: Colors.primary, paddingVertical: 18,
    borderRadius: Radius.full, alignItems: 'center', marginTop: Spacing.sm,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.lg },
  linkBtn: { alignItems: 'center', marginTop: Spacing.lg },
  linkText: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.sm },
  skipText: { color: Colors.gray[400], fontWeight: '600', fontSize: Fonts.sizes.sm },
});
