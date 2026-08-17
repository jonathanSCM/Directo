import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { Logo } from '../../src/components/Logo';
import { authService } from '../../src/services/auth';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>

        <View style={styles.logoIcon}>
          <Logo size={40} variant="blue" />
        </View>

        {sent ? (
          <>
            <Text style={styles.title}>Revisa tu correo</Text>
            <Text style={styles.subtitle}>
              Si {email.trim()} tiene una cuenta con nosotros, te mandamos un enlace para restablecer tu contraseña. Puede tardar unos minutos en llegar.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.primaryBtnText}>Volver a iniciar sesión</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
            <Text style={styles.subtitle}>
              Ingresa tu email y te mandamos un enlace para restablecerla.
            </Text>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={Colors.gray[400]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Enviar enlace</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: Spacing.xxl, paddingTop: 56, paddingBottom: 40 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.gray[200],
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoIcon: { marginBottom: Spacing.lg },
  title: { fontSize: 26, fontWeight: '800', color: Colors.gray[900], marginBottom: 6 },
  subtitle: { fontSize: Fonts.sizes.md, color: Colors.gray[500], marginBottom: Spacing.xxxl, lineHeight: 22 },
  errorText: { color: '#DC2626', fontSize: Fonts.sizes.sm, marginBottom: Spacing.md },
  fieldGroup: { gap: 6, marginBottom: Spacing.lg },
  label: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    gap: 10, backgroundColor: Colors.white,
  },
  input: { flex: 1, fontSize: Fonts.sizes.md, color: Colors.gray[900], padding: 0 },
  primaryBtn: {
    backgroundColor: Colors.primary, paddingVertical: 18,
    borderRadius: Radius.full, alignItems: 'center', marginTop: Spacing.sm,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.lg },
});
