import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  count: number;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be inside FavoritesProvider');
  return ctx;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  const fetchIds = useCallback(async () => {
    if (!isAuthenticated) {
      setFavorites([]);
      return;
    }
    try {
      const { data } = await api.get('/favorites/ids');
      setFavorites(data);
    } catch {
      setFavorites([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchIds();
  }, [fetchIds]);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;
      const was = favorites.includes(id);
      setFavorites((prev) =>
        was ? prev.filter((f) => f !== id) : [...prev, id],
      );
      try {
        await api.post(`/favorites/${id}`);
      } catch {
        setFavorites((prev) =>
          was ? [...prev, id] : prev.filter((f) => f !== id),
        );
      }
    },
    [favorites, isAuthenticated],
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        count: favorites.length,
        refreshFavorites: fetchIds,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
