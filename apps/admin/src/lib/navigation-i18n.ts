import type { TranslationFunction } from '@/context/LanguageContext'

export interface LocalizableNavigationItem {
  name: string
  i18nKey?: string
}

/** Existing entries use their name as a compatibility key. New entries can
 * provide i18nKey so their visible label may change without breaking identity. */
export function getNavigationLabel(
  t: TranslationFunction,
  item: LocalizableNavigationItem | string,
): string {
  const navigationItem = typeof item === 'string' ? { name: item } : item
  const key = navigationItem.i18nKey ?? `menu.${navigationItem.name}`
  return t(key, { fallback: navigationItem.name })
}
