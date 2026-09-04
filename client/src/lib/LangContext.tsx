import React, { createContext, useContext } from 'react';
import type { Lang } from './i18n';
import { useLang, t as translate } from './i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Parameters<typeof translate>[0]) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translate(key, 'en'),
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components -- hook exported alongside provider intentionally
export function useLangContext() {
  return useContext(LangContext);
}
