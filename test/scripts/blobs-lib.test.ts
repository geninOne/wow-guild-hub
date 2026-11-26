import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { liveUebernahme, sammleEintraege, uebernehmen } from "../../scripts/blobs-lib.mjs";

let quelle: string;

function datei(pfad: string, inhalt: string) {
  const voll = join(quelle, pfad);
  mkdirSync(dirname(voll), { recursive: true });
  writeFileSync(voll, inhalt);
}

beforeEach(() => {
  quelle = mkdtempSync(join(tmpdir(), "blobs-"));
  datei("entries/unlinked/site:gilde/guild", '{"name":"Bärenklaue"}');
  datei("entries/unlinked/site:gilde/characters/1", '{"id":1}');
  datei("entries/unlinked/site:gilde/history/2026-11-06", '{"tag":"geheim"}');
  datei("metadata/unlinked/site:gilde/guild", "{}");
  datei("metadata/unlinked/site:gilde/characters/1", '{"quelle":"lokal"}');
});

afterEach(() => rmSync(quelle, { recursive: true, force: true }));

function fakeZiel(vorhanden: string[] = []) {
  const gesetzt: { key: string; inhalt: string; metadata?: object }[] = [];
  let gelistet = 0;
  return {
    gesetzt,
    get gelistet() {
      return gelistet;
    },
    async list() {
      gelistet++;
      return vorhanden;
    },
    async set(key: string, inhalt: string, metadata?: object) {
      gesetzt.push({ key, inhalt, metadata });
    },
  };
}

describe("sammleEintraege", () => {
  test("liefert alle Schlüssel des Stores mit Größe und nicht leeren Metadaten", async () => {
    const eintraege = await sammleEintraege(quelle);
    expect(eintraege.map((e) => e.key)).toEqual(["characters/1", "guild", "history/2026-11-06"]);
    expect(eintraege.find((e) => e.key === "guild")).toMatchObject({ groesse: 22, metadata: null });
    expect(eintraege.find((e) => e.key === "characters/1")?.metadata).toEqual({ quelle: "lokal" });
  });

  test("bricht bei mehreren Site-Ordnern mit deren Namen ab", async () => {
    datei("entries/abc123/site:gilde/guild", "{}");
    await expect(sammleEintraege(quelle)).rejects.toThrow(/abc123.*unlinked|unlinked.*abc123/);
  });

  test("bricht ab, wenn der Store oder die Quelle fehlt", async () => {
    await expect(sammleEintraege(quelle, "anderer")).rejects.toThrow(/site:anderer/);
    await expect(sammleEintraege(join(quelle, "gibt-es-nicht"))).rejects.toThrow(/entries/);
  });
});

describe("uebernehmen", () => {
  test("Trockenlauf listet nur auf und fasst das Ziel nicht an", async () => {
    const ziel = fakeZiel();
    const log: string[] = [];
    const ergebnis = await uebernehmen({
      eintraege: await sammleEintraege(quelle),
      ziel,
      trocken: true,
      log: (z: string) => log.push(z),
    });
    expect(ziel.gelistet).toBe(0);
    expect(ziel.gesetzt).toEqual([]);
    expect(ergebnis).toEqual({ hochgeladen: 0, eintraege: 3, bytes: 22 + 8 + 16 });
    expect(log.join("\n")).toContain("characters/1");
    expect(log.join("\n")).toMatch(/Trockenlauf/);
  });

  test("lädt den Inhalt unverändert hoch, mit Metadaten nur wo vorhanden", async () => {
    const ziel = fakeZiel();
    const log: string[] = [];
    const ergebnis = await uebernehmen({
      eintraege: await sammleEintraege(quelle),
      ziel,
      trocken: false,
      log: (z: string) => log.push(z),
    });
    expect(ergebnis.hochgeladen).toBe(3);
    expect(ziel.gesetzt).toContainEqual({ key: "guild", inhalt: '{"name":"Bärenklaue"}', metadata: undefined });
    expect(ziel.gesetzt).toContainEqual({ key: "characters/1", inhalt: '{"id":1}', metadata: { quelle: "lokal" } });
    expect(log.join("\n")).not.toContain("geheim");
  });

  test("bricht ab, wenn das Ziel schon Einträge hat, außer mit ueberschreiben", async () => {
    const eintraege = await sammleEintraege(quelle);
    const ziel = fakeZiel(["guild"]);
    await expect(uebernehmen({ eintraege, ziel, trocken: false, log: () => {} })).rejects.toThrow(/--ueberschreiben/);
    expect(ziel.gesetzt).toEqual([]);

    const erlaubt = await uebernehmen({ eintraege, ziel, trocken: false, ueberschreiben: true, log: () => {} });
    expect(erlaubt.hochgeladen).toBe(3);
  });
});

describe("liveUebernahme", () => {
  function ablauf(antwort: string, token = "tok-geheim") {
    const schritte: string[] = [];
    const log: string[] = [];
    const ziel = fakeZiel();
    const optionen = {
      quelle,
      log: (z: string) => {
        log.push(z);
        if (z.startsWith("Trockenlauf")) schritte.push("trockenlauf");
      },
      bestaetigen: async (frage: string) => {
        schritte.push(`frage: ${frage}`);
        return antwort;
      },
      frageToken: async () => {
        schritte.push("token");
        return token;
      },
      erstelleZiel: (t: string) => {
        schritte.push(`ziel mit ${t === "tok-geheim" ? "token" : "anderem"}`);
        return ziel;
      },
    };
    return { schritte, log, ziel, optionen };
  }

  test("zeigt erst den Trockenlauf, fragt dann und lädt nach ja mit dem Token hoch", async () => {
    const { schritte, log, ziel, optionen } = ablauf("ja");
    const ergebnis = await liveUebernahme(optionen);
    expect(schritte).toEqual(["trockenlauf", "frage: 3 Einträge in den Store gilde der Netlify-Site hochladen? (ja/nein) ", "token", "ziel mit token"]);
    expect(ergebnis?.hochgeladen).toBe(3);
    expect(ziel.gesetzt).toHaveLength(3);
    expect(log.join("\n")).not.toContain("tok-geheim");
  });

  test("ohne ja wird nichts hochgeladen und kein Token abgefragt", async () => {
    const { schritte, ziel, optionen } = ablauf("n");
    expect(await liveUebernahme(optionen)).toBeNull();
    expect(schritte).not.toContain("token");
    expect(ziel.gesetzt).toEqual([]);
  });

  test("leerer Token bricht ab", async () => {
    const { ziel, optionen } = ablauf("ja", "  ");
    await expect(liveUebernahme(optionen)).rejects.toThrow(/Token/);
    expect(ziel.gesetzt).toEqual([]);
  });
});
