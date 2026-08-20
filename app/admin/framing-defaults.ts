export const FRAMING_DIMENSIONS = [
  { key: "uenighed", label: "Uenighed" },
  { key: "ikke_vores_bord", label: "Ikke vores bord" },
  { key: "vigtigt", label: "Vigtigt" },
  { key: "lykkedes", label: "Lykkedes" },
] as const;

export const DEFAULT_FRAMING_DEFINITIONS: Record<string, string> = {
  uenighed:
    "Områder hvor lederne reelt er uenige om retning, prioritering eller fortolkning — ikke blot forskellig sprogbrug om det samme.",
  ikke_vores_bord:
    "Emner eller beslutninger der ligger uden for denne ledergruppes mandat — noget andre (fx bestyrelsen eller en anden afdeling) skal tage stilling til.",
  vigtigt:
    "Det som har størst betydning for om strategien lykkes — det der bør prioriteres højst, uanset hvor svært det er at adressere.",
  lykkedes:
    "Hvordan det ser ud, når strategien er implementeret succesfuldt — de konkrete tegn på at målet er nået.",
};
