/**
 * A synthesis row generated before a content-shape change (workshop plan,
 * then alignment/basis) has an old-shaped content blob - since synthesis is
 * always fully overwritten (never migrated in place), treat it as stale
 * rather than render a half-formed page. Shared by the results page and the
 * facilitator presentation view so both agree on what counts as "current".
 */
export function hasCurrentShapeSynthesis(content: unknown): boolean {
  const dimensions = (content as { dimensions?: unknown })?.dimensions;
  const agendaItems = (
    content as { workshopPlan?: { agendaItems?: unknown } }
  )?.workshopPlan?.agendaItems;
  return (
    !!content &&
    Array.isArray((content as { topPriorities?: unknown })?.topPriorities) &&
    !!(content as { workshopPlan?: unknown })?.workshopPlan &&
    Array.isArray(dimensions) &&
    dimensions.every(
      (d) =>
        typeof (d as { keyPoint?: unknown }).keyPoint === "string" &&
        Array.isArray((d as { participantBases?: unknown }).participantBases)
    ) &&
    Array.isArray(agendaItems) &&
    agendaItems.every((item) => typeof (item as { shortTitle?: unknown }).shortTitle === "string")
  );
}
