// Evaluation for scripts/explore-statistics.mjs: pure functions, no network and no files.

/** Median of a list of numbers (for an even count, the mean of the two middle values). */
export function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Field names of an object (for arrays those of the first entry), for spotting additional fields. */
export function fieldsOf(data) {
  if (data === null || typeof data !== "object") return [];
  return Object.keys(Array.isArray(data) ? (data[0] ?? {}) : data).sort();
}

/**
 * Walks all categories and subcategories of a statistics response.
 * @returns {{ category: {id:number,name:string}, parent: {id:number,name:string}|null, stat: any }[]}
 */
export function statisticEntries(data) {
  const result = [];
  for (const k of data?.categories ?? []) {
    for (const s of k.statistics ?? []) result.push({ category: { id: k.id, name: k.name }, parent: null, stat: s });
    for (const u of k.sub_categories ?? []) {
      for (const s of u.statistics ?? []) result.push({ category: { id: u.id, name: u.name }, parent: { id: k.id, name: k.name }, stat: s });
    }
  }
  return result;
}

/**
 * Evaluates statistics responses.
 * @param {{ member: { id: number, name: string, level: number }, data: any }[]} responses
 */
export function evaluate(responses) {
  const stats = new Map();
  const categories = new Map();
  const statFields = new Set();
  const categoryFields = new Set();
  const responseFields = new Set();
  let withText = 0;
  for (const { member, data } of responses) {
    fieldsOf(data).forEach((f) => responseFields.add(f));
    for (const k of data?.categories ?? []) {
      fieldsOf(k).forEach((f) => categoryFields.add(f));
      if (!categories.has(k.id)) categories.set(k.id, { id: k.id, name: k.name, parent: null });
      for (const u of k.sub_categories ?? []) {
        fieldsOf(u).forEach((f) => categoryFields.add(f));
        if (!categories.has(u.id)) categories.set(u.id, { id: u.id, name: u.name, parent: k.id });
      }
    }
    for (const { category, parent, stat } of statisticEntries(data)) {
      fieldsOf(stat).forEach((f) => statFields.add(f));
      if (typeof stat.description === "string") withText++;
      const entry = stats.get(stat.id) ?? {
        id: stat.id,
        name: stat.name,
        category: category.id,
        parent: parent?.id ?? null,
        values: [],
        top: null,
        textSample: null,
      };
      const value = typeof stat.quantity === "number" ? stat.quantity : 0;
      entry.values.push(value);
      if (entry.top === null || value > entry.top.value) entry.top = { value, name: member.name };
      if (entry.textSample === null && typeof stat.description === "string") entry.textSample = stat.description;
      stats.set(stat.id, entry);
    }
  }
  const list = [...stats.values()].map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    parent: s.parent,
    count: s.values.length,
    sum: s.values.reduce((a, b) => a + b, 0),
    max: Math.max(...s.values),
    median: median(s.values),
    top: s.top,
    textSample: s.textSample,
  }));
  const order = [...categories.keys()];
  list.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.id - b.id);
  return {
    characters: responses.length,
    categories: [...categories.values()],
    statistics: list,
    fields: {
      response: [...responseFields].sort(),
      category: [...categoryFields].sort(),
      statistic: [...statFields].sort(),
      statisticsWithText: withText,
    },
  };
}

const num = (n) => (n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Tables per category for the report, without names of individual characters. */
export function markdownTables(evaluation) {
  const lines = [];
  for (const k of evaluation.categories) {
    const own = evaluation.statistics.filter((s) => s.category === k.id);
    if (own.length === 0) continue;
    const parent = k.parent === null ? "" : `${evaluation.categories.find((o) => o.id === k.parent)?.name ?? k.parent} / `;
    lines.push(`#### ${parent}${k.name} (${k.id})`, "", "| ID | Statistic | Characters | Sum | Maximum | Median |", "|---:|---|---:|---:|---:|---:|");
    for (const s of own) {
      lines.push(`| ${s.id} | ${s.name} | ${s.count} | ${num(s.sum)} | ${num(s.max)} | ${num(s.median)} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Kind of a statistic for later pages (the values are stored data and stay German): "zaehler" (counter) grows with
 * every event (differences are deeds in the period), "stand" (level) is a current level or maximum (skill, recipes,
 * mounts), "text" counts the most frequent of a sort and carries its name as text, "schnitt" (average) is an average
 * (differences are meaningless). The patterns match the German statistic names from Blizzard (locale de_DE).
 */
export function kindOf(stat) {
  if (stat.textSample) return "text";
  if (/^Durchschnittlich/.test(stat.name)) return "schnitt";
  if (/^(Höchste|Meiste|Erlernte|Bekannte)|fertigkeit$|Fertigkeit$|besessen|besessenen|auf maximaler|begegnet insgesamt|Unterschiedliche/.test(stat.name)) return "stand";
  return "zaehler";
}

/**
 * Updates the static list: new categories and statistics are added, known ones keep their details (even if they are
 * missing from this evaluation, because Blizzard omits zero values), names are updated. The list is stored in
 * config/statistics.json.
 */
export function updateList(list, evaluation) {
  const categories = new Map((list?.categories ?? []).map((k) => [k.id, k]));
  for (const k of evaluation.categories) categories.set(k.id, { id: k.id, name: k.name, parent: k.parent });
  const statistics = new Map((list?.statistics ?? []).map((s) => [s.id, s]));
  for (const s of evaluation.statistics) {
    const old = statistics.get(s.id);
    statistics.set(s.id, { id: s.id, name: s.name, category: s.category, kind: old?.kind ?? kindOf(s) });
  }
  const order = [...categories.keys()];
  return {
    _note: list?._note ?? NOTE,
    categories: [...categories.values()],
    statistics: [...statistics.values()].sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.id - b.id,
    ),
  };
}

// Stored as _note in config/statistics.json.
const NOTE =
  "Names and categories of the character statistics (Blizzard endpoint achievements/statistics, German). WoW Forever has no endpoint with all definitions, so the list is extended from the responses seen: npm run stats:explore. The weekly snapshots under stats/<Saturday> contain only statistic ID and value. kind: zaehler (events, the difference is meaningful), stand (current value or maximum), text (most frequent of a sort, name in the character record under statTexts), schnitt (average, the difference is meaningless).";
