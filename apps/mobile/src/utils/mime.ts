const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Algunos pickers (sobre todo tras recortar con allowsEditing) no devuelven
 * mimeType, y el fallback ingenuo `image/${ext}` genera "image/jpg" — que
 * ningún backend acepta (el mime real es "image/jpeg"). Este helper
 * normaliza la extensión a un mime válido.
 */
export function guessImageMimeType(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
  return EXT_TO_MIME[ext] ?? 'image/jpeg';
}
