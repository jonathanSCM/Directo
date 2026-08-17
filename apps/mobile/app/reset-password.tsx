import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Logo } from '../src/components/Logo';
import { authService } from '../src/services/auth';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!token) {
      setError('El enlace no es válido. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'El enlace venció o no es válido. Pedí uno nuevo.');
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
        <View style={styles.logoIcon}>
          <Logo size={40} variant="blue" />
        </View>

        {done ? (
          <>
            <Text style={styles.title}>Contraseña actualizada</Text>
            <Text style={styles.subtitle}>Ya podés iniciar sesión con tu nueva contraseña.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.primaryBtnText}>Iniciar sesión</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Nueva contraseña</Text>
            <Text style={styles.subtitle}>Elegí una contraseña nueva para tu cuenta.</Text>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña nueva</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.gray[400]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.gray[400]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmar contraseña</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.gray[400]}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showPassword}
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
                <Text style={styles.primaryBtnText}>Guardar contraseña</Text>
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
  scroll: { paddingHorizontal: Spacing.xxl, paddingTop: 80, paddingBottom: 40 },
  logoIcon: { marginBottom: Spacing.lg, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.gray[900], marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: Fonts.sizes.md, color: Colors.gray[500], marginBottom: Spacing.xxxl, lineHeight: 22, textAlign: 'center' },
  errorText: { color: '#DC2626', fontSize: Fonts.sizes.sm, marginBottom: Spacing.md, textAlign: 'center' },
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
