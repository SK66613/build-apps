import React from "react";
import { LANGS, useI18n } from "../i18n";

export function LanguageSelect({ className = "", disabled }: { className?: string; disabled?: boolean }) {
  const { lang, setLang } = useI18n();

  return (
    <select
      className={className || "lang-select"}
      value={lang}
      onChange={(e) => setLang(e.target.value as any)}
      disabled={disabled}
      aria-label="Language"
      title="Language"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
