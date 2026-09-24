import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import * as Localization from "expo-localization"

import en from "./locales/en.json"
import nl from "./locales/nl.json"
import pt from "./locales/pt.json"

const SUPPORTED = ["en", "nl", "pt"]

const deviceLanguageTag = Localization.getLocales?.()[0]?.languageCode
const deviceLanguage = SUPPORTED.includes(deviceLanguageTag) ? deviceLanguageTag : "en"

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    nl: { translation: nl },
    pt: { translation: pt },
  },
  lng: deviceLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
})

export default i18n
