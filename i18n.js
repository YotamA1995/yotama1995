const SUPPORTED_LANGUAGES = ["en", "he"];
const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "tinytale-language";
const TRANSLATION_PATH = "i18n";
const translationCache = new Map();

let currentLanguage = DEFAULT_LANGUAGE;
let requestedLanguage = DEFAULT_LANGUAGE;
let activeRequestToken = null;

const safeStorage = {
  get(key) {
    try {
      if (typeof window === "undefined" || !("localStorage" in window)) {
        return null;
      }
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set(key, value) {
    try {
      if (typeof window === "undefined" || !("localStorage" in window)) {
        return;
      }
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* ignore write failures (e.g., Safari private mode) */
    }
  },
};

const getNestedValue = (object, path) => {
  return path.split(".").reduce((accumulator, key) => {
    if (accumulator && Object.prototype.hasOwnProperty.call(accumulator, key)) {
      return accumulator[key];
    }
    return undefined;
  }, object);
};

const fetchTranslations = (language) => {
  if (translationCache.has(language)) {
    const cached = translationCache.get(language);
    if (cached instanceof Promise) {
      return cached;
    }
    return Promise.resolve(cached);
  }

  const request = fetch(`${TRANSLATION_PATH}/${language}.json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load translations for ${language}`);
      }
      return response.json();
    })
    .then((data) => {
      translationCache.set(language, data);
      return data;
    })
    .catch((error) => {
      translationCache.delete(language);
      throw error;
    });

  translationCache.set(language, request);
  return request;
};

const resolveInitialLanguage = () => {
  const stored = safeStorage.get(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }

  if (typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
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
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return;
  }

  if (language === requestedLanguage && !activeRequestToken) {
    return;
  }

  requestedLanguage = language;
  const requestToken = Symbol("language-request");
  activeRequestToken = requestToken;

  if (language === currentLanguage) {
    updateDirectionality(language);
    updateLanguageSwitcher(language);
    announceLanguageChange(
      translationCache.get(language) instanceof Promise
        ? undefined
        : translationCache.get(language)
    );
    activeRequestToken = null;
    return;
  }

  try {
    const translations = await fetchTranslations(language);
    if (requestedLanguage !== language || activeRequestToken !== requestToken) {
      return;
    }

    currentLanguage = language;
    applyTranslations(language, translations);
    if (persist) {
      safeStorage.set(STORAGE_KEY, language);
    }
  } catch (error) {
    console.error(error);
    if (requestedLanguage === language) {
      requestedLanguage = currentLanguage;
    }
    if (language !== DEFAULT_LANGUAGE && requestedLanguage !== DEFAULT_LANGUAGE) {
      requestedLanguage = DEFAULT_LANGUAGE;
      setLanguage(DEFAULT_LANGUAGE, { persist });
    }
  } finally {
    if (activeRequestToken === requestToken) {
      activeRequestToken = null;
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
  const initialLanguage = resolveInitialLanguage();
  bindLanguageSwitcher();

  if (initialLanguage === currentLanguage) {
    updateDirectionality(initialLanguage);
    updateLanguageSwitcher(initialLanguage);
    if (!safeStorage.get(STORAGE_KEY)) {
      safeStorage.set(STORAGE_KEY, initialLanguage);
    }
    return;
  }

  try {
    await setLanguage(initialLanguage);
    if (!safeStorage.get(STORAGE_KEY)) {
      safeStorage.set(STORAGE_KEY, initialLanguage);
    }
  } catch (error) {
    console.error(error);
    if (initialLanguage !== DEFAULT_LANGUAGE) {
      requestedLanguage = DEFAULT_LANGUAGE;
      setLanguage(DEFAULT_LANGUAGE, { persist: false });
    }
  }
};

document.addEventListener("DOMContentLoaded", initializeTranslations);
