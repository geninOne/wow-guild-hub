import { DUNGEON_INFO, normName as norm, type ExtraDungeon } from "../instance-images";
import type { CharacterRecord, GuildRecord, IconMap, InstanceAchievementsRecord } from "../model";
import { characterRef } from "./fun-common";
import { guildRefs, memberGuild } from "./guild-view";
import { buildInstancesView, instanceImage } from "./instances-view";
import type { CharacterRef, GuildDungeonsView, GuildDungeonView, GuildRaidView, MemberValue } from "./types";

interface DungeonAcc extends GuildDungeonView {
  /** Abgeschlossene Alternativen der Bezeichnung mit der Zahl der Abschlüsse. */
  alternatives: Map<string, number>;
  order: number;
}

/** Höchster Wert zuerst, bei Gleichstand nach ID, damit die Antwort stabil bleibt. */
const byValue = (list: MemberValue[]) => [...list].sort((a, b) => b[1] - a[1] || a[0] - b[0]);

const firstAlternative = (description: string) => description.split(" oder ")[0];

/**
 * Dungeons und Raids über alle übergebenen Charaktere. Gegenstücke beider Fraktionen ("Flammenschlund oder Halle der
 * Thanen") zählen als ein Dungeon; angezeigt werden die Alternativen, die jemand abgeschlossen hat.
 */
export function buildGuildDungeons(
  guild: GuildRecord,
  records: CharacterRecord[],
  defs: InstanceAchievementsRecord | null,
  images: IconMap | null,
  guildSlug: string | null,
  extras: ExtraDungeon[] = [],
): GuildDungeonsView {
  const guilds = guildRefs(guild);
  const members = new Map(guild.members.map((m) => [m.id, m]));
  const refs = records.flatMap((r): { ref: CharacterRef; record: CharacterRecord; faction: string }[] => {
    const m = members.get(r.id);
    return m ? [{ ref: characterRef(guild, m), record: r, faction: memberGuild(guild, m, guilds).faction }] : [];
  });
  const picked = refs.filter((x) => guildSlug === null || x.ref.guildSlug === guildSlug);
  const base: GuildDungeonsView = {
    available: !!defs && defs.achievements.length > 0, guilds, guild: guildSlug, characters: picked.length,
    dungeons: [], raids: [], frontier: null,
  };
  if (!base.available) return base;

  const dungeons = new Map<string, DungeonAcc>();
  const raids = new Map<string, GuildRaidView & { bossIndex: Map<string, number> }>();
  let order = 0;
  for (const { ref, record, faction } of picked) {
    const view = buildInstancesView(defs, record.instances, images, DUNGEON_INFO, extras, faction);
    for (const tier of view.dungeonTiers) {
      for (const d of tier.dungeons) {
        const key = norm(firstAlternative(d.description));
        let acc = dungeons.get(key);
        if (!acc) {
          acc = {
            key, name: firstAlternative(d.description), tier: tier.tier, image: d.image, levels: d.levels, completed: 0,
            tracked: d.tracked, timesCompleted: 0, best: null, lastAt: null, who: [], alternatives: new Map(), order: order++,
          };
          dungeons.set(key, acc);
        }
        acc.image ??= d.image;
        acc.levels ??= d.levels;
        acc.timesCompleted += d.timesCompleted;
        if (d.completedAt && (!acc.lastAt || d.completedAt > acc.lastAt)) acc.lastAt = d.completedAt;
        if (d.timesCompleted > 0 && (!acc.best || d.timesCompleted > acc.best.times)) {
          acc.best = { character: ref, times: d.timesCompleted };
        }
        if (d.completed) {
          acc.completed++;
          acc.who.push([ref.id, d.timesCompleted]);
          // Ohne Kill weiß man nicht, welche Alternative es war, dann zählen alle.
          for (const alt of d.name.split(" oder ")) acc.alternatives.set(alt, (acc.alternatives.get(alt) ?? 0) + 1);
        }
      }
    }
    for (const r of view.raids) {
      let acc = raids.get(r.name);
      if (!acc) {
        acc = {
          name: r.name, image: r.image, levels: r.levels, completed: 0,
          bosses: r.bosses.map((b) => ({ name: b.name, defeated: 0 })),
          bossIndex: new Map(r.bosses.map((b, i) => [b.name, i])), who: [],
        };
        raids.set(r.name, acc);
      }
      if (r.completed) acc.completed++;
      let down = 0;
      for (const b of r.bosses) {
        const i = acc.bossIndex.get(b.name);
        if (b.defeated && i !== undefined) {
          acc.bosses[i].defeated++;
          down++;
        }
      }
      if (down > 0) acc.who.push([ref.id, down]);
    }
  }

  const list = [...dungeons.values()]
    .map(({ alternatives, order: _order, ...d }): GuildDungeonView & { order: number } => {
      const names = [...alternatives.keys()].sort((a, b) => (a === d.name ? -1 : b === d.name ? 1 : a.localeCompare(b, "de")));
      const name = names.length > 0 ? names.join(" oder ") : d.name;
      // Bild zum angezeigten Namen, damit "Flammenschlund" nicht das Bild der Halle der Thanen erbt.
      return { ...d, name, image: instanceImage(name, images) ?? d.image, order: _order };
    })
    .sort((a, b) => (a.levels?.min ?? 99) - (b.levels?.min ?? 99) || a.order - b.order)
    .map(({ order: _o, ...d }) => ({ ...d, who: byValue(d.who) }));

  // Gildenspitze: Dungeon mit dem höchsten Mindestlevel, den jemand geschafft hat, und wer.
  const top = [...list].reverse().find((d) => d.completed > 0);
  let frontier: GuildDungeonsView["frontier"] = null;
  if (top) {
    const who = picked.filter(({ record, faction }) =>
      buildInstancesView(defs, record.instances, images, DUNGEON_INFO, extras, faction).dungeonTiers.some((t) =>
        t.dungeons.some((d) => d.completed && norm(firstAlternative(d.description)) === top.key),
      ),
    );
    frontier = { dungeon: top.name, characters: who.map((w) => w.ref) };
  }

  return {
    ...base,
    dungeons: list,
    raids: [...raids.values()].map(({ bossIndex: _b, ...r }) => ({ ...r, who: byValue(r.who) })),
    frontier,
  };
}
