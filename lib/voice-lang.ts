/**
 * Best-effort guess at the BCP-47 language tag of a short piece of text,
 * based on a handful of very common stopwords per language. This backs the
 * Web Speech API's `lang` setting for voice input, so it only needs to be
 * roughly right - a wrong guess just means slightly worse recognition
 * accuracy, not a broken feature. Falls back to null when no language
 * scores clearly ahead of the others.
 */
const STOPWORDS: Record<string, string[]> = {
  "da-DK": ["og", "jeg", "ikke", "det", "er", "vi", "hvordan", "hvad", "men", "også"],
  "sv-SE": ["och", "jag", "inte", "det", "är", "vi", "hur", "vad", "men", "också"],
  "de-DE": ["und", "ich", "nicht", "das", "ist", "wir", "wie", "was", "aber", "auch"],
  "fr-FR": ["et", "je", "pas", "est", "nous", "comment", "que", "mais", "aussi"],
  "es-ES": ["y", "yo", "no", "es", "nosotros", "cómo", "qué", "pero", "también"],
  "nl-NL": ["en", "ik", "niet", "het", "is", "wij", "hoe", "wat", "maar", "ook"],
  "en-GB": ["and", "the", "is", "we", "how", "what", "but", "also", "you"],
};

export function guessLanguageTag(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  let bestTag: string | null = null;
  let bestScore = 0;
  for (const [tag, stopwords] of Object.entries(STOPWORDS)) {
    const score = words.filter((w) => stopwords.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTag = tag;
    }
  }
  // Require at least two stopword hits before trusting the guess over the
  // browser's own language setting.
  return bestScore >= 2 ? bestTag : null;
}
