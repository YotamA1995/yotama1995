const SUPPORTED_LANGUAGES = ["en", "he"];
const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "tinytale-language";
const TRANSLATION_PATH = "i18n";
const translationCache = new Map();
let currentLanguage = DEFAULT_LANGUAGE;

const getNestedValue = (object, path) => {
  return path.split(".").reduce((accumulator, key) => {
    if (accumulator && Object.prototype.hasOwnProperty.call(accumulator, key)) {
      return accumulator[key];
    }
    return undefined;
  }, object);
};

const fetchTranslations = async (language) => {
  if (translationCache.has(language)) {
    return translationCache.get(language);
  }

  const response = await fetch(`${TRANSLATION_PATH}/${language}.json`);
  if (!response.ok) {
    throw new Error(`Unable to load translations for ${language}`);
  }

  const data = await response.json();
  translationCache.set(language, data);
  return data;
};

const resolveInitialLanguage = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }

  const navigatorLanguages = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language];

  const detected = navigatorLanguages
    .map((locale) => (typeof locale === "string" ? locale.slice(0, 2).toLowerCase() : ""))
    .find((locale) => SUPPORTED_LANGUAGES.includes(locale));

  return detected || DEFAULT_LANGUAGE;
};

const updateDirectionality = (language) => {
  const html = document.documentElement;
  const isRTL = language === "he";
  html.lang = language;
  html.dir = isRTL ? "rtl" : "ltr";
};

const applyTextTranslation = (element, value) => {
  if (element.tagName === "TITLE") {
    document.title = value;
    return;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
    return;
  }

  element.textContent = value;
};

const applyAttributeTranslations = (element, translations) => {
  const attrMap = element.dataset.i18nAttr;
  if (!attrMap) return;

  attrMap.split(";").forEach((mapping) => {
    const [attribute, key] = mapping.split(":").map((part) => part.trim());
    if (!attribute || !key) return;

    const value = getNestedValue(translations, key);
    if (typeof value === "undefined") return;

    if (attribute in element) {
      element[attribute] = value;
    } else {
      element.setAttribute(attribute, value);
    }
  });
};

const updateLanguageSwitcher = (language) => {
  document.querySelectorAll(".language-option").forEach((button) => {
    const isActive = button.dataset.lang === language;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("is-active", isActive);
  });
};

const announceLanguageChange = (translations) => {
  const liveRegion = document.getElementById("language-status");
  if (!liveRegion) return;

  const message = getNestedValue(translations, "languageSwitcher.status");
  if (typeof message === "undefined") return;

  liveRegion.textContent = "";
  window.requestAnimationFrame(() => {
    liveRegion.textContent = message;
  });
};

const applyTranslations = (language, translations) => {
  updateDirectionality(language);

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) return;

    const value = getNestedValue(translations, key);
    if (typeof value === "undefined") return;

    applyTextTranslation(element, value);
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    applyAttributeTranslations(element, translations);
  });

  updateLanguageSwitcher(language);
  announceLanguageChange(translations);
};

const setLanguage = async (language, { persist = true } = {}) => {
  if (!SUPPORTED_LANGUAGES.includes(language) || language === currentLanguage) {
    return;
  }

  try {
    const translations = await fetchTranslations(language);
    currentLanguage = language;
    applyTranslations(language, translations);
    if (persist) {
      localStorage.setItem(STORAGE_KEY, language);
    }
  } catch (error) {
    console.error(error);
    if (language !== DEFAULT_LANGUAGE) {
      setLanguage(DEFAULT_LANGUAGE, { persist });
    }
  }
};

const bindLanguageSwitcher = () => {
  document.querySelectorAll(".language-option").forEach((button) => {
    button.addEventListener("click", () => {
      const targetLanguage = button.dataset.lang;
      if (targetLanguage) {
        setLanguage(targetLanguage);
      }
    });
  });
};

const initializeTranslations = async () => {
  currentLanguage = resolveInitialLanguage();
  bindLanguageSwitcher();

  try {
    const translations = await fetchTranslations(currentLanguage);
    applyTranslations(currentLanguage, translations);
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, currentLanguage);
    }
  } catch (error) {
    console.error(error);
    if (currentLanguage !== DEFAULT_LANGUAGE) {
      setLanguage(DEFAULT_LANGUAGE, { persist: false });
    }
  }
};

document.addEventListener("DOMContentLoaded", initializeTranslations);
