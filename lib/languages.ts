/**
 * Languages a participant can choose for their interview. `code` is a
 * BCP-47 tag, used both as the stored value on the session record and
 * directly as the Web Speech API's `lang` setting for voice input - one
 * list backs both, so there's no separate mapping to keep in sync.
 */
export type InterviewLanguage = {
  code: string;
  label: string;
};

export const INTERVIEW_LANGUAGES: InterviewLanguage[] = [
  { code: "en-GB", label: "English" },
  { code: "da-DK", label: "Danish" },
  { code: "sv-SE", label: "Swedish" },
  { code: "nb-NO", label: "Norwegian" },
  { code: "de-DE", label: "German" },
  { code: "fr-FR", label: "French" },
  { code: "es-ES", label: "Spanish" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-PT", label: "Portuguese" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "nl-NL", label: "Dutch" },
  { code: "pl-PL", label: "Polish" },
  { code: "cs-CZ", label: "Czech" },
  { code: "sk-SK", label: "Slovak" },
  { code: "hu-HU", label: "Hungarian" },
  { code: "ro-RO", label: "Romanian" },
  { code: "bg-BG", label: "Bulgarian" },
  { code: "el-GR", label: "Greek" },
  { code: "hr-HR", label: "Croatian" },
  { code: "sr-RS", label: "Serbian" },
  { code: "sl-SI", label: "Slovenian" },
  { code: "is-IS", label: "Icelandic" },
  { code: "fi-FI", label: "Finnish" },
  { code: "ru-RU", label: "Russian" },
  { code: "uk-UA", label: "Ukrainian" },
  { code: "tr-TR", label: "Turkish" },
  { code: "ar-SA", label: "Arabic" },
  { code: "he-IL", label: "Hebrew" },
  { code: "fa-IR", label: "Persian" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-BD", label: "Bengali" },
  { code: "ur-PK", label: "Urdu" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "th-TH", label: "Thai" },
  { code: "id-ID", label: "Indonesian" },
  { code: "ms-MY", label: "Malay" },
  { code: "tl-PH", label: "Filipino (Tagalog)" },
  { code: "sw-KE", label: "Swahili" },
];

export const DEFAULT_INTERVIEW_LANGUAGE_CODE = "en-GB";

export function getInterviewLanguageLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return INTERVIEW_LANGUAGES.find((l) => l.code === code)?.label ?? null;
}
