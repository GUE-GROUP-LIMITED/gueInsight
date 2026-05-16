import { createElement, createContext, useContext, useState } from 'react';
import en from '../locales/en.json';
import nl from '../locales/nl.json';
import fr from '../locales/fr.json';

const LOCALES = { en, nl, fr };

const detectLanguage = () => {
  if (typeof navigator === 'undefined') return 'en';
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('site-lang') : null;
  if (stored && ['en', 'nl', 'fr'].includes(stored)) return stored;
  const lang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
  if (lang === 'nl' || lang === 'fr') return lang;
  return 'en';
};

const I18nContext = createContext({
  lang: 'en',
  t: (k) => k,
  setLang: () => {},
});

export const I18nProvider = ({ children, defaultLang }) => {
  const initial = defaultLang || detectLanguage();
  const [lang, setLang] = useState(initial);

  const t = (key, values = {}) => {
    const parts = key.split('.');
    let node = LOCALES[lang] || LOCALES.en;
    for (const p of parts) {
      node = node?.[p];
      if (node == null) return key;
    }
    if (typeof node === 'string') {
      return node.replace(/\{(\w+)\}/g, (_, name) => (values[name] == null ? `{${name}}` : String(values[name])));
    }
    // If the node is an object or array, return it as-is so callers can handle it (e.g., feature lists)
    return node;
  };

  const wrappedSetLang = (l) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('site-lang', l);
    setLang(l);
  };
  return createElement(I18nContext.Provider, { value: { lang, setLang: wrappedSetLang, t } }, children);
};

export const useTranslation = () => useContext(I18nContext);

export default { I18nProvider, useTranslation };
