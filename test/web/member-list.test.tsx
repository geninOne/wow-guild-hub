// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GuildView, MemberRow, StatCardMembersView, StatCardView } from "../../src/api/types";
import { ueberall } from "../../src/sprache";
import { MemberListDialog, type MemberSet } from "../../web/src/components/MemberList";
import { statMemberSets, statMembersPath } from "../../web/src/components/StatCards";
import {
  activeMemberIds,
  filterMemberList,
  MEMBER_SEARCH_FROM,
  resolveMembers,
  sortMemberList,
} from "../../web/src/lib/member-list";
import { SpracheProvider, type Sprache } from "../../web/src/lib/sprache";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function member(over: Partial<MemberRow>): MemberRow {
  return {
    id: 1, name: "X", surname: null, slug: "x", level: 10, classId: 5, className: "Priester", raceId: 1, raceName: "Mensch",
    rank: 1, rankName: "Offizier", itemLevel: null, mainSpecName: null, hasProfile: true, former: false,
    guildSlug: "bärenklaue", guildName: "Bärenklaue", professions: [], ...over,
  };
}

const members: MemberRow[] = [
  member({ id: 1, name: "Anna", slug: "anna", level: 60, raceName: "Orc" }),
  member({ id: 2, name: "Bodo", slug: "bodo", level: 12, classId: 1, className: "Krieger", raceName: "Zwerg", guildSlug: "goldene-bärenklaue", guildName: "Goldene Bärenklaue" }),
  member({ id: 3, name: "Cleo", slug: "cleo", level: 60, classId: 8, className: "Magier", raceName: "Untoter" }),
  member({ id: 4, name: "Weg", slug: "weg", level: 60, former: true }),
];

const guildView: GuildView = {
  fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 3,
  guilds: [
    { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 2, main: true },
    { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, main: false },
  ],
  classes: [], ranks: [], members,
};

describe("selecting the set", () => {
  test("activeMemberIds: active members from a minimum level, optionally of one guild only", () => {
    expect(activeMemberIds(members, null)).toEqual([1, 2, 3]);
    expect(activeMemberIds(members, null, 60)).toEqual([1, 3]);
    expect(activeMemberIds(members, "goldene-bärenklaue")).toEqual([2]);
  });

  test("resolveMembers: adds member data, unknown ones as placeholders, duplicate IDs once", () => {
    const rows = resolveMembers([[3, 7], [99, 2], [3, 1], [4, 0]], members);
    expect(rows.map((r) => [r.id, r.name, r.value, r.known])).toEqual([
      [3, "Cleo", 7, true],
      [99, "Unbekannt", 2, false],
      [4, "Weg", 0, true],
    ]);
    expect(rows[0]).toMatchObject({ className: "Magier", raceName: "Untoter", level: 60, guildSlug: "bärenklaue" });
    expect(resolveMembers([1], members)[0].value).toBeNull();
  });

  test("filterMemberList: guild and name part, unknown ones only for all guilds", () => {
    const rows = resolveMembers([1, 2, 3, 99], members);
    expect(filterMemberList(rows, "bärenklaue", "").map((r) => r.id)).toEqual([1, 3]);
    expect(filterMemberList(rows, null, "").map((r) => r.id)).toEqual([1, 2, 3, 99]);
    expect(filterMemberList(rows, null, " LE ").map((r) => r.id)).toEqual([3]);
  });

  test("sortMemberList: numbers and texts in both directions, missing values last, ties by name", () => {
    const rows = resolveMembers([[1, 5], [2, 9], [3, 5], [99, 1]], members);
    expect(sortMemberList(rows, "value", "desc").map((r) => r.id)).toEqual([2, 1, 3, 99]);
    expect(sortMemberList(rows, "level", "asc").map((r) => r.id)).toEqual([2, 1, 3, 99]);
    expect(sortMemberList(rows, "className", "asc").map((r) => r.className)).toEqual(["Krieger", "Magier", "Priester", ""]);
    expect(sortMemberList(rows, "name", "desc").map((r) => r.name)).toEqual(["Unbekannt", "Cleo", "Bodo", "Anna"]);
  });

  test("statMemberSets: one set per statistic with short name and unit, statistics without an answer are dropped", () => {
    const card: StatCardView = {
      slug: "tode", form: "grabsteinfeld", title: ueberall("Tode"), blurb: null, span: 3,
      stats: [
        { id: 60, name: "Tode insgesamt", art: "zaehler", total: 9, perGuild: {}, leaders: [], holders: 2, sum: 9, classId: null, short: { de: "Tode", en: "Tode", schwaebisch: "Tod", bayrisch: "Tod" }, unit: ueberall<[string, string]>(["Tod", "Tode"]), honor: null, conversion: null },
        { id: 114, name: "Tode durch Stürze", art: "zaehler", total: 1, perGuild: {}, leaders: [], holders: 1, sum: 1, classId: null, short: null, unit: null, honor: null, conversion: null },
        { id: 112, name: "Ertrinken", art: "zaehler", total: 0, perGuild: {}, leaders: [], holders: 0, sum: 0, classId: null, short: null, unit: null, honor: null, conversion: null },
      ],
    };
    const data: StatCardMembersView = { slug: "tode", stats: [{ id: 60, entries: [[1, 7], [2, 2]] }, { id: 114, entries: [[2, 1]] }] };
    expect(statMemberSets(card, data, "schwaebisch")).toEqual([
      { key: "60", label: "Tod", valueLabel: "Tode", entries: [[1, 7], [2, 2]] },
      { key: "114", label: "Tode durch Stürze", valueLabel: "Tode durch Stürze", entries: [[2, 1]] },
    ]);
  });

  test("statMembersPath: period as in the view, card as query", () => {
    expect(statMembersPath({ kind: "gesamt", id: null }, "tode")).toBe("/api/stats?card=tode");
    expect(statMembersPath({ kind: "woche", id: "2026-11-21" }, "flaeschle")).toBe("/api/stats/week/2026-11-21?card=flaeschle");
    expect(statMembersPath({ kind: "monat", id: null }, "a b")).toBe("/api/stats/month?card=a%20b");
  });
});

function renderDialog(sets: MemberSet[] | null, opts: { guild?: string | null; language?: Sprache; onClose?: () => void } = {}) {
  const onClose = opts.onClose ?? vi.fn();
  render(
    <SpracheProvider start={opts.language ?? "de"}>
      <MemoryRouter>
        <button type="button">Trigger</button>
        <MemberListDialog title="Auf Level 60" sets={sets} guild={opts.guild ?? null} guildView={guildView} onClose={onClose} />
      </MemoryRouter>
    </SpracheProvider>,
  );
  return onClose;
}

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("MemberListDialog", () => {
  test("table with name as link, class in class color, race, level and value; sortable", () => {
    renderDialog([{ key: "a", label: "Fische", valueLabel: "Fische", entries: [[1, 5], [3, 9], [2, 1]] }]);
    const dialog = screen.getByRole("dialog", { name: "Auf Level 60" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(bodyRows().map((r) => r.querySelector("a")?.textContent)).toEqual(["Cleo", "Anna", "Bodo"]);
    expect(within(bodyRows()[0]).getByRole("link", { name: "Cleo" }).getAttribute("href")).toBe("/charakter/cleo");
    expect(bodyRows()[0].textContent).toContain("Untoter");
    const header = screen.getByRole("columnheader", { name: /Fische/ });
    expect(header.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByRole("button", { name: "Nach Fische sortieren" }));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(bodyRows().map((r) => r.querySelector("a")?.textContent)).toEqual(["Bodo", "Anna", "Cleo"]);
    fireEvent.click(screen.getByRole("button", { name: "Nach Name sortieren" }));
    expect(bodyRows().map((r) => r.querySelector("a")?.textContent)).toEqual(["Anna", "Bodo", "Cleo"]);
    expect(screen.getByRole("status").textContent).toBe("3 Mitglieder");
  });

  test("guild switcher starts with the page's choice and filters", () => {
    renderDialog([{ key: "a", label: "Alle", valueLabel: null, entries: [1, 2, 3] }], { guild: "bärenklaue" });
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByRole("columnheader", { name: /Wert/ })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
    expect(bodyRows().map((r) => r.querySelector("a")?.textContent)).toEqual(["Bodo"]);
    fireEvent.click(screen.getByRole("radio", { name: "Alle" }));
    expect(bodyRows()).toHaveLength(3);
  });

  test("search only from 15 entries", () => {
    const many: MemberRow[] = Array.from({ length: MEMBER_SEARCH_FROM }, (_, i) => member({ id: 100 + i, name: `Held${i}`, slug: `held${i}` }));
    const view = { ...guildView, members: [...members, ...many] };
    render(
      <MemoryRouter>
        <MemberListDialog title="Viele" sets={[{ key: "a", label: "Viele", valueLabel: null, entries: many.map((m) => m.id) }]} guild={null} guildView={view} onClose={() => {}} />
      </MemoryRouter>,
    );
    const search = screen.getByRole("searchbox", { name: "Nach Namen suchen" });
    fireEvent.change(search, { target: { value: "held1" } });
    expect(bodyRows().map((r) => r.querySelector("a")?.textContent)).toEqual(["Held1", "Held10", "Held11", "Held12", "Held13", "Held14"]);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Kein Name passt zur Suche.")).toBeTruthy();
    cleanup();
    renderDialog([{ key: "a", label: "Wenige", valueLabel: null, entries: [1, 2] }]);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("several sets: the picker switches the value column", () => {
    renderDialog([
      { key: "a", label: "Tode", valueLabel: "Tode", entries: [[1, 5]] },
      { key: "b", label: "Stürze", valueLabel: "Stürze", entries: [[2, 3], [3, 1]] },
    ]);
    expect(bodyRows()).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Wert" }), { target: { value: "b" } });
    expect(screen.getByRole("columnheader", { name: /Stürze/ })).toBeTruthy();
    expect(bodyRows()).toHaveLength(2);
  });

  test("Escape and the close button close it, focus starts on close and returns to the trigger", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <button type="button">Trigger</button>
      </MemoryRouter>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    const { unmount } = render(
      <MemoryRouter>
        <MemberListDialog title="Liste" sets={[{ key: "a", label: "A", valueLabel: null, entries: [1] }]} guild={null} guildView={guildView} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Schließen" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test("loading: hint instead of table; texts in Bavarian", () => {
    renderDialog(null, { language: "bayrisch" });
    expect(screen.getByText("Lad Datn")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zuamacha" })).toBeTruthy();
  });
});
