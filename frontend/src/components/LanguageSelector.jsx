import { useTranslation } from '../i18n/index';

const LanguageSelector = () => {
  const { lang, setLang } = useTranslation();
  const { t } = useTranslation();

  return (
    <label className="app-navbar__language" aria-label={t('language.label')}>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        <option value="en">EN</option>
        <option value="nl">NL</option>
        <option value="fr">FR</option>
      </select>
    </label>
  );
};

export default LanguageSelector;
