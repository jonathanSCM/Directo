import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

/**
 * Acento de color según el rol activo. Cambio sutil, no dos apps distintas:
 * solo tiñe tab activo y botones principales de pantallas de propietario.
 */
export const OwnerAccent = {
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primaryLight: '#EDE9FE',
};

export function useRoleColors() {
  const { user } = useAuth();
  const isOwner = user?.active_role === 'owner';
  return {
    isOwner,
    accent: isOwner ? OwnerAccent.primary : Colors.primary,
    accentDark: isOwner ? OwnerAccent.primaryDark : Colors.primaryDark,
    accentLight: isOwner ? OwnerAccent.primaryLight : Colors.primaryLight,
  };
}
