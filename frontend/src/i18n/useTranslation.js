import { useAppStore } from "../store/appStore"
import { t } from "./translations"

export function useTranslation() {
  const lang = useAppStore(s => s.language)
  return {
    t: (key) => t(key, lang),
    lang,
  }
}
