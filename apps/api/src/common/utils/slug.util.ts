import { randomUUID } from 'crypto';

const DIACRITICS = /[̀-ͯ]/g;

/** Convierte un texto a slug: minúsculas, sin acentos, separado por guiones. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS, '') // quita acentos (diacríticos combinables)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Genera un slug único agregando un sufijo corto aleatorio. */
export function uniqueSlug(text: string, fallback = 'propiedad'): string {
  const base = slugify(text) || fallback;
  return `${base}-${randomUUID().slice(0, 8)}`;
}
