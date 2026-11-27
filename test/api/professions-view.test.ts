import { describe, expect, test } from "vitest";
import { buildProfessionRecipesView, buildProfessionsView } from "../../src/api/professions-view";
import type { CharacterProfession, CharacterRecord, MemberSummary, RecipeDetail } from "../../src/model";
import { recipeDisplayNames } from "../../src/api/recipes";

function member(over: Partial<MemberSummary>): MemberSummary {
  return {
    id: 1, name: "Test", surname: null, slug: "test", rank: 0, level: 10, classId: 1, raceId: 1,
    hasProfile: true, former: false, firstSeenAt: "2026-11-01T00:00:00.000Z", leftAt: null,
    lastFetchedAt: null, equippedItemLevel: null, mainSpecName: null, professions: [], ...over,
  };
}

function prof(over: Partial<CharacterProfession> & { id: number }): CharacterProfession {
  return { name: "", nameEn: "", skill: 1, max: 75, primary: true, recipes: [], ...over };
}

function record(id: number, professions: CharacterProfession[]): CharacterRecord {
  return {
    id, name: `C${id}`, surname: null, slug: `c${id}`, fetchedAt: "2026-11-06T10:00:00.000Z",
    hasProfile: true, level: 10, classId: 1, raceId: 1, className: null, raceName: null, gender: null,
    rulesetName: null, equippedItemLevel: null, lastLoginAt: null, media: null, equipment: [],
    specs: [], mainSpecId: null, professions, raidsRaw: null,
  };
}

const members: MemberSummary[] = [
  member({ id: 1, name: "Anna", slug: "anna", classId: 8 }),
  member({ id: 2, name: "Bea", slug: "bea", classId: 5 }),
  member({ id: 3, name: "Gelmar", slug: "gelmar", classId: 5 }),
  member({ id: 4, name: "Ehemalig", slug: "ehemalig", former: true }),
  member({ id: 5, name: "Ohnerecord", slug: "ohnerecord" }),
];

const linen = "Bolt of Linen Cloth";
const records: CharacterRecord[] = [
  record(1, [
    prof({ id: 197, name: "Schneiderei", skill: 120, max: 150, recipes: [linen, "Linen Belt"] }),
    prof({ id: 186, name: "Bergbau", skill: 50, recipes: ["Smelt Copper", "Smelt Tin"] }),
  ]),
  record(2, [
    prof({ id: 197, name: "Schneiderei", skill: 30, recipes: [linen] }),
    prof({ id: 186, name: "Bergbau", skill: 30, recipes: ["Smelt Copper"] }),
  ]),
  record(3, [prof({ id: 197, name: "Schneiderei", skill: 37, max: 75, recipes: ["Linen Belt"] })]),
  record(4, [prof({ id: 197, name: "Schneiderei", skill: 300, recipes: [linen] })]),
];

describe("buildProfessionsView", () => {
  test("professions: only active members, skill descending, German names", () => {
    const v = buildProfessionsView(members, records);
    const tailoring = v.professions.find((p) => p.id === 197)!;
    expect(tailoring).toMatchObject({ name: "Schneiderei", primary: true });
    expect(tailoring.members.map((m) => [m.name, m.skill, m.max])).toEqual([
      ["Anna", 120, 150], ["Gelmar", 37, 75], ["Bea", 30, 75],
    ]);
    expect(Object.values(v.characters).some((c) => c.former)).toBe(false);
    expect(v.characters["4"]).toBeUndefined();
    expect(v.characters["5"]).toBeUndefined();
  });

  test("all professions in the groups Handwerk, Sammeln, Nebenberufe, even without members; unknown ones at the end", () => {
    const v = buildProfessionsView(members, [
      record(1, [prof({ id: 197, name: "", skill: 5 }), prof({ id: 186, name: "Bergbau" }), prof({ id: 999, name: "" })]),
    ]);
    expect(v.professions.map((p) => [p.group, p.name, p.members.length])).toEqual([
      ["Handwerk", "Alchemie", 0],
      ["Handwerk", "Schmiedekunst", 0],
      ["Handwerk", "Lederverarbeitung", 0],
      ["Handwerk", "Schneiderei", 1],
      ["Handwerk", "Verzauberkunst", 0],
      ["Handwerk", "Ingenieurskunst", 0],
      ["Sammeln", "Bergbau", 1],
      ["Sammeln", "Kräuterkunde", 0],
      ["Sammeln", "Kürschnerei", 0],
      ["Nebenberufe", "Kochkunst", 0],
      ["Nebenberufe", "Angeln", 0],
      ["Nebenberufe", "Erste Hilfe", 0],
      ["Weitere Berufe", "Beruf 999", 1],
    ]);
  });

  test("URL slugs without umlauts, icons and class names", () => {
    const v = buildProfessionsView(members, records, {
      classes: { items: [{ id: 8, name: "Magier" }] },
      icons: { "186": "https://render.worldofwarcraft.com/forever-eu/icons/56/136248.jpg" },
    });
    const slugs = Object.fromEntries(v.professions.map((p) => [p.name, p.slug]));
    expect([slugs["Bergbau"], slugs["Kräuterkunde"], slugs["Kürschnerei"], slugs["Erste Hilfe"]]).toEqual([
      "bergbau", "kraeuterkunde", "kuerschnerei", "erste-hilfe",
    ]);
    expect(v.professions.find((p) => p.id === 186)?.icon).toBe("https://render.worldofwarcraft.com/forever-eu/icons/56/136248.jpg");
    expect(v.professions.find((p) => p.id === 171)?.icon).toBeNull();
    expect([v.characters["1"].className, v.characters["2"].className]).toEqual(["Magier", "Klasse 5"]);
  });

});

describe("German recipes and guilds", () => {
  test("recipeDisplayNames: German, otherwise English", () => {
    const p = prof({ id: 186, recipes: ["Smelt Tin", "Mining"], recipeIds: [1848, 1570] });
    expect(recipeDisplayNames(p, { "1848": "Zinn verhütten", "1570": null })).toEqual(["Zinn verhütten", "Mining"]);
    expect(recipeDisplayNames(p, null)).toEqual(["Smelt Tin", "Mining"]);
    expect(recipeDisplayNames(prof({ id: 186, recipes: ["Smelt Tin"] }), { "1848": "Zinn verhütten" })).toEqual(["Smelt Tin"]);
  });

  test("recipeDisplayNames: name from the details before the name table", () => {
    const p = prof({ id: 186, recipes: ["Smelt Tin", "Smelt Copper"], recipeIds: [1848, 2657] });
    const details = { "1848": detail(1848, "Zinn verhütten (Details)"), "2657": null };
    expect(recipeDisplayNames(p, { "1848": "Zinn verhütten", "2657": "Kupfer verhütten" }, details)).toEqual([
      "Zinn verhütten (Details)",
      "Kupfer verhütten",
    ]);
  });

  test("professions without recipe list, characters with guild", () => {
    const ms = [
      member({ id: 1, name: "Anna", slug: "anna", guildSlug: "goldene-bärenklaue" }),
      member({ id: 2, name: "Bea", slug: "bea" }),
    ];
    const recs = [
      record(1, [prof({ id: 186, name: "Bergbau", recipes: ["Smelt Tin"], recipeIds: [1848] })]),
      record(2, [prof({ id: 186, name: "Bergbau", recipes: ["Smelt Tin"] })]),
    ];
    const guilds = [
      { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 76, main: true },
      { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, main: false },
    ];
    const v = buildProfessionsView(ms, recs, { guilds });
    expect("recipes" in v).toBe(false);
    expect(v.guilds).toEqual(guilds);
    expect([v.characters["1"].guildSlug, v.characters["2"].guildSlug]).toEqual(["goldene-bärenklaue", "bärenklaue"]);
    expect(v.professions.find((p) => p.id === 186)!.members.map((m) => m.guildSlug)).toEqual(["goldene-bärenklaue", "bärenklaue"]);
  });
});

function detail(id: number, name: string, over: Partial<RecipeDetail> = {}): RecipeDetail {
  return { id, name, description: null, icon: null, craftedQuantity: 1, item: null, reagents: [], ...over };
}

describe("buildProfessionRecipesView", () => {
  const recs = [
    record(1, [
      prof({ id: 197, name: "Schneiderei", recipes: [linen, "Linen Belt"], recipeIds: [2963, 8776] }),
      prof({ id: 186, name: "Bergbau", recipes: ["Smelt Copper"], recipeIds: [2657] }),
    ]),
    record(2, [prof({ id: 197, name: "Schneiderei", recipes: [linen], recipeIds: [2963] })]),
    record(3, [prof({ id: 197, name: "Schneiderei", recipes: ["Old Recipe", linen] })]),
    record(4, [prof({ id: 197, name: "Schneiderei", recipes: [linen], recipeIds: [2963] })]),
  ];
  const recipeDetails = {
    "2963": detail(2963, "Leinenstoffballen", { reagents: [{ id: 2589, name: "Leinenstoff", quantity: 2 }] }),
    "8776": detail(8776, "Leinengürtel"),
  };

  test("only recipes of the profession, one entry per ID, sorted in German, with details and reagent icons", () => {
    const v = buildProfessionRecipesView(members, recs, "schneiderei", {
      recipeDetails,
      itemIcons: { "2589": "https://render.worldofwarcraft.com/forever-eu/icons/56/132889.jpg" },
    })!;
    expect(v.professionId).toBe(197);
    expect(v.slug).toBe("schneiderei");
    expect(v.recipes.map((r) => [r.id, r.name, r.characterIds])).toEqual([
      [null, linen, [3]],
      [8776, "Leinengürtel", [1]],
      [2963, "Leinenstoffballen", [1, 2]],
      [null, "Old Recipe", [3]],
    ]);
    expect(v.recipes[2].recipe?.reagents).toEqual([
      { id: 2589, name: "Leinenstoff", quantity: 2, icon: "https://render.worldofwarcraft.com/forever-eu/icons/56/132889.jpg" },
    ]);
    expect(v.recipes[0].recipe).toBeNull();
  });

  test("unknown slug yields null, known profession without members an empty list", () => {
    expect(buildProfessionRecipesView(members, recs, "gibtsnicht", {})).toBeNull();
    expect(buildProfessionRecipesView(members, recs, "alchemie", {})).toEqual({ professionId: 171, slug: "alchemie", recipes: [] });
  });
});

test("characters carry their surname", () => {
  const ms = [member({ id: 1, name: "Luvia", surname: "Stav", slug: "luvia-stav" }), member({ id: 2, name: "Bea", slug: "bea" })];
  const recs = [record(1, [prof({ id: 186, recipes: ["Smelt Tin"] })]), record(2, [prof({ id: 186, recipes: [] })])];
  const v = buildProfessionsView(ms, recs);
  expect([v.characters["1"].surname, v.characters["2"].surname]).toEqual(["Stav", null]);
});
