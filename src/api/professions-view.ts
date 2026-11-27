import type { CharacterRecord, IconMap, MemberSummary, NamedList, RecipeDetails, RecipeNames } from "../model";
import { PROFESSION_NAMES_DE, professionSlug } from "../transform/professions";

export { professionSlug };
import { lookupName } from "./guild-view";
import { recipeDisplayNames, recipeView } from "./recipes";
import type { CharacterRef, GuildRef, ProfessionRecipe, ProfessionRecipesView, ProfessionsView } from "./types";

const collator = (a: string, b: string): number => a.localeCompare(b, "de");

/** Groups and order of the professions in the directory. */
export const PROFESSION_GROUPS: [string, number[]][] = [
  ["Handwerk", [171, 164, 165, 197, 333, 202]],
  ["Sammeln", [186, 182, 393]],
  ["Nebenberufe", [185, 356, 129]],
];
const OTHER_GROUP = "Weitere Berufe";


export function buildProfessionsView(
  members: MemberSummary[],
  records: CharacterRecord[],
  options: {
    guilds?: GuildRef[];
    classes?: NamedList | null;
    icons?: IconMap | null;
  } = {},
): ProfessionsView {
  const guilds = options.guilds ?? [];
  const groupOf = new Map(PROFESSION_GROUPS.flatMap(([group, ids]) => ids.map((id) => [id, group] as const)));
  const newEntry = (id: number, name: string, primary: boolean): ProfessionsView["professions"][number] => ({
    id,
    name,
    slug: professionSlug(name),
    group: groupOf.get(id) ?? OTHER_GROUP,
    icon: options.icons?.[String(id)] ?? null,
    primary,
    members: [],
  });
  const recordById = new Map(records.map((r) => [r.id, r]));
  const characters: Record<string, CharacterRef> = {};

  const professions = new Map<number, ProfessionsView["professions"][number]>();

  for (const m of members) {
    if (m.former) continue;
    const record = recordById.get(m.id);
    if (!record) continue;
    const ref: CharacterRef = {
      id: m.id,
      name: m.name,
      surname: m.surname,
      slug: m.slug,
      classId: m.classId,
      className: lookupName(options.classes ?? null, m.classId, `Klasse ${m.classId}`),
      former: false,
      guildSlug: guilds.find((g) => g.slug === m.guildSlug)?.slug ?? guilds[0]?.slug ?? "",
    };
    characters[String(m.id)] = ref;

    for (const p of record.professions) {
      const name = p.name || PROFESSION_NAMES_DE[p.id] || `Beruf ${p.id}`;
      let entry = professions.get(p.id);
      if (!entry) {
        entry = newEntry(p.id, name, p.primary);
        professions.set(p.id, entry);
      }
      entry.members.push({ ...ref, skill: p.skill, max: p.max });

    }
  }

  // All known professions in a fixed order, even without members; unknown ones alphabetically after them.
  const known = PROFESSION_GROUPS.flatMap(([group, ids]) =>
    ids.map((id) => professions.get(id) ?? newEntry(id, PROFESSION_NAMES_DE[id] ?? `Beruf ${id}`, group !== "Nebenberufe")),
  );
  const others = [...professions.values()].filter((p) => !groupOf.has(p.id)).sort((a, b) => collator(a.name, b.name));
  const professionList = [...known, ...others];
  for (const p of professionList) {
    p.members.sort((a, b) => b.skill - a.skill || collator(a.name, b.name));
  }
  return { guilds, professions: professionList, characters };
}

const displayName = (id: number, name: string): string => name || PROFESSION_NAMES_DE[id] || `Beruf ${id}`;

/**
 * All recipes of a profession (by URL slug) with the active characters who know them.
 * The same recipe ID yields one entry; older data without an ID is merged by name.
 * null for an unknown slug.
 */
export function buildProfessionRecipesView(
  members: MemberSummary[],
  records: CharacterRecord[],
  slug: string,
  options: { recipeNames?: RecipeNames | null; recipeDetails?: RecipeDetails | null; itemIcons?: IconMap | null },
): ProfessionRecipesView | null {
  const active = new Set(members.filter((m) => !m.former).map((m) => m.id));
  const knownId = Object.entries(PROFESSION_NAMES_DE).find(([, name]) => professionSlug(name) === slug)?.[0];
  const professionId =
    knownId !== undefined
      ? Number(knownId)
      : records.flatMap((r) => r.professions).find((p) => professionSlug(displayName(p.id, p.name)) === slug)?.id;
  if (professionId === undefined) return null;

  const recipes = new Map<string, ProfessionRecipe>();
  for (const record of records) {
    if (!active.has(record.id)) continue;
    for (const p of record.professions) {
      if (p.id !== professionId) continue;
      const names = recipeDisplayNames(p, options.recipeNames ?? null, options.recipeDetails);
      names.forEach((name, i) => {
        const id = p.recipeIds?.[i];
        const key = id !== undefined ? `id:${id}` : `name:${name}`;
        let entry = recipes.get(key);
        if (!entry) {
          entry = {
            id: id ?? null,
            name,
            characterIds: [],
            recipe: recipeView(id, options.recipeDetails ?? null, options.itemIcons ?? null),
          };
          recipes.set(key, entry);
        }
        if (!entry.characterIds.includes(record.id)) entry.characterIds.push(record.id);
      });
    }
  }
  const list = [...recipes.values()].sort((a, b) => collator(a.name, b.name));
  for (const r of list) r.characterIds.sort((a, b) => a - b);
  return { professionId, slug, recipes: list };
}
