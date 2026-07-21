import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [saving, setSaving] = useState(false);

  const hasChanges =
    name !== (user?.name ?? '') ||
    phone !== (user?.phone ?? '') ||
    city !== (user?.city ?? '');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/users/me', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      });
      if (refreshUser) await refreshUser();
      Alert.alert('Listo', 'Tu perfil ha sido actualizado', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')) },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const initial = name?.charAt(0).toUpperCase() ?? '?';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.gray[400]}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Correo electrónico</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.disabledText}>{user?.email}</Text>
          </View>
          <Text style={styles.hint}>El correo no se puede cambiar</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+591 70000000"
            placeholderTextColor={Colors.gray[400]}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ciudad</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Santa Cruz de la Sierra"
            placeholderTextColor={Colors.gray[400]}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !hasChanges}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  content: { padding: Spacing.xxl, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  field: { marginBottom: Spacing.xl },
  label: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  inputDisabled: {
    backgroundColor: Colors.gray[50],
    justifyContent: 'center',
  },
  disabledText: {
    fontSize: Fonts.sizes.md,
    color: Colors.gray[400],
  },
  hint: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[400],
    marginTop: Spacing.xs,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: Colors.white,
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
  },
});
