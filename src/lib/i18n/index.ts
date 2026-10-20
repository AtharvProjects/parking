import en, { type TranslationKeys } from './en';
import mr from './mr';
import hi from './hi';

export type Language = 'en' | 'mr' | 'hi';

export const LANGUAGES: { code: Language; label: string; nativeLabel: string; flag: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी', flag: '🇮🇳' },
];

const dictionaries: Record<Language, TranslationKeys> = {
  en,
  mr,
  hi,
};

export type TranslationKey = FlattenKeys<TranslationKeys>;

// Utility type to flatten nested keys with dot notation
type FlattenKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? FlattenKeys<T[K], `${Prefix}${K & string}.`>
    : `${Prefix}${K & string}`;
}[keyof T];

/**
 * Get a translated string by dot-notation key.
 * e.g. getTranslation('en', 'gate.newVehicleEntry') → "New Vehicle Entry"
 */
export function getTranslation(lang: Language, key: string): string {
  const parts = key.split('.');
  let result: any = dictionaries[lang];
  
  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = result[part];
    } else {
      // Fallback to English
      let fallback: any = dictionaries.en;
      for (const fp of parts) {
        if (fallback && typeof fallback === 'object' && fp in fallback) {
          fallback = fallback[fp];
        } else {
          return key; // key itself as last resort
        }
      }
      return typeof fallback === 'string' ? fallback : key;
    }
  }
  
  return typeof result === 'string' ? result : key;
}

/**
 * Get the entire dictionary for a language (useful for PDF generation
 * where we pass the dict directly instead of using React context).
 */
export function getDictionary(lang: Language): TranslationKeys {
  return dictionaries[lang] || dictionaries.en;
}

export type TranslationFunction = ((key: string) => string) & TranslationKeys;

/**
 * Creates a dual-purpose translation object that works both as a function:
 *   t('gate.newVehicleEntry')
 * and as an object property hierarchy:
 *   t.gate.newVehicleEntry
 * with complete null-safety and automatic English fallback.
 */
export function createTranslationProxy(lang: Language): TranslationFunction {
  const dict = dictionaries[lang] || dictionaries.en;
  const enDict = dictionaries.en;

  const fn = function (key: string): string {
    return getTranslation(lang, key);
  };

  function makeSafeProxy(target: any, fallbackTarget: any): any {
    return new Proxy(target || {}, {
      get(t, prop, receiver) {
        if (typeof prop === 'symbol') return Reflect.get(t, prop, receiver);
        const val = (t && t[prop] !== undefined) ? t[prop] : fallbackTarget?.[prop];
        if (typeof val === 'object' && val !== null) {
          return makeSafeProxy(val, fallbackTarget?.[prop]);
        }
        return val ?? '';
      }
    });
  }

  return new Proxy(fn, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      if (prop in fn) return Reflect.get(target, prop, receiver);

      const val = (dict as any)?.[prop] !== undefined ? (dict as any)?.[prop] : (enDict as any)?.[prop];
      if (typeof val === 'object' && val !== null) {
        return makeSafeProxy(val, (enDict as any)?.[prop]);
      }
      return val ?? '';
    }
  }) as TranslationFunction;
}

export { type TranslationKeys };
