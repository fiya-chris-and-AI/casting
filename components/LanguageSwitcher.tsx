"use client";

import { SUPPORTED_LOCALES, useLocale, useT, type LocaleCode } from "@/lib/i18n/LocaleProvider";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <select
      value={locale}
      aria-label={t("language.switcherLabel")}
      onChange={(e) => setLocale(e.target.value as LocaleCode)}
      className={className ?? "underline decoration-dotted underline-offset-2 bg-transparent hover:text-[var(--foreground)]"}
      style={{ border: "none", cursor: "pointer" }}
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
