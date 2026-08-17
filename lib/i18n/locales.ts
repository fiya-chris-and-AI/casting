import en from "@/locales/en.json";
import zhTW from "@/locales/zh-TW.json";
import zhCN from "@/locales/zh-CN.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import es from "@/locales/es.json";
import pt from "@/locales/pt.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import it from "@/locales/it.json";
import th from "@/locales/th.json";
import id from "@/locales/id.json";
import vi from "@/locales/vi.json";
import tr from "@/locales/tr.json";
import ru from "@/locales/ru.json";
import nl from "@/locales/nl.json";
import pl from "@/locales/pl.json";

export const DEFAULT_LOCALE = "en" as const;

// Locale list matches yce.perfectcorp.com — 16 translations + en as source.
// zh-TW is first among the translations: the jury (Perfect Corp, New Taipei City) reads it.
export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "th", label: "ไทย" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

export type Messages = Record<string, string>;

export const MESSAGES: Record<LocaleCode, Messages> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  ja,
  ko,
  es,
  pt,
  fr,
  de,
  it,
  th,
  id,
  vi,
  tr,
  ru,
  nl,
  pl,
};

export function isSupportedLocale(code: string | null | undefined): code is LocaleCode {
  return !!code && SUPPORTED_LOCALES.some((l) => l.code === code);
}
