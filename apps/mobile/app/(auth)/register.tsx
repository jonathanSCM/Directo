import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/zones');
        const uniqueCities = [...new Set<string>(data.map((z: any) => z.city))].sort();
        setCities(uniqueCities);
      } catch {
        setCities(['Santa Cruz de la Sierra', 'La Paz', 'Cochabamba']);
      }
    })();
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Nombre, email y contraseña son obligatorios');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!terms) {
      Alert.alert('Error', 'Debes aceptar los términos y condiciones');
      return;
    }
    setLoading(true);
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
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg ?? 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/onboarding')}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>

        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Una sola cuenta para comprar y vender.</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nombre completo</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={Colors.gray[400]} />
              <TextInput
                style={styles.input}
                placeholder="Carla Méndez"
                placeholderTextColor={Colors.gray[400]}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

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
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Teléfono</Text>
              <View style={styles.inputRow}>
                <Text style={styles.countryCode}>BO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+591700..."
                  placeholderTextColor={Colors.gray[400]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Ciudad</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setShowCityPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={city ? styles.inputText : styles.placeholder}>
                  {city || 'Seleccionar'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.gray[400]} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={Colors.gray[400]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setTerms(!terms)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={terms ? 'checkbox' : 'square-outline'}
              size={24}
              color={terms ? Colors.primary : Colors.gray[300]}
            />
            <Text style={styles.termsText}>
              Acepto los <Text style={styles.termsLink}>Términos</Text> y la{' '}
              <Text style={styles.termsLink}>Política de Privacidad</Text>
              {'\n'}de DIRECTO.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCityPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona tu ciudad</Text>
            {cities.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.modalOption,
                  city === c && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setCity(c);
                  setShowCityPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    city === c && styles.modalOptionTextActive,
                  ]}
                >
                  {c}
                </Text>
                {city === c && (
                  <Ionicons name="checkmark" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.gray[900],
    marginBottom: 6,
  },
  subtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.gray[400],
    marginBottom: Spacing.xxl,
  },
  form: { gap: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.md },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    gap: 10,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
    padding: 0,
  },
  inputText: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
  },
  placeholder: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[400],
  },
  countryCode: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.gray[500],
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  termsText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[600],
    flex: 1,
    lineHeight: 20,
  },
  termsLink: { color: Colors.primary, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Fonts.sizes.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: { color: Colors.gray[500], fontSize: Fonts.sizes.md },
  footerLink: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.xxl,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.lg,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalOptionActive: {
    backgroundColor: Colors.primaryLight,
    marginHorizontal: -Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    borderBottomColor: Colors.primaryLight,
  },
  modalOptionText: {
    fontSize: Fonts.sizes.md,
    color: Colors.gray[700],
  },
  modalOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
