import { describe, it, expect } from "vitest";
import {
  NAV_GROUPS,
  filterNavGroups,
  navSectionsFor,
  departmentPath,
  navGroupTitleKeyForSlug,
} from "./app-shell";
import { MODULES } from "@/pages/home";

/**
 * The navigation filter is what every surface trusts.
 *
 * The horizontal bar, the mobile drawer, the breadcrumb and the department
 * cards all render whatever this returns, so a gap here is a gap in all four
 * at once. These assert the properties that made the surfaces disagree before:
 * permissions inside sections used to be ignored, and each surface used to
 * decide for itself what to show.
 */

/** Every href the tree contains, at any depth. */
function hrefsOf(groups: typeof NAV_GROUPS): string[] {
  return groups.flatMap((g) => [
    ...g.items.map((i) => i.href),
    ...(g.subGroups ?? []).flatMap((s) => s.items.map((i) => i.href)),
  ]);
}

const WILDCARD = { permissions: ["*"], roles: ["Super Administrator"] };

describe("navigation filter", () => {
  it("shows a wildcard holder the whole tree", () => {
    expect(hrefsOf(filterNavGroups(WILDCARD))).toHaveLength(hrefsOf(NAV_GROUPS).length);
  });

  it("hides an entry whose permission the user lacks", () => {
    // /secretariat is gated on secretariat.view and lives inside a section, so
    // this is also the regression guard for section-level filtering.
    const withIt = hrefsOf(filterNavGroups({ permissions: ["secretariat.view"], roles: [] }));
    const withoutIt = hrefsOf(filterNavGroups({ permissions: [], roles: [] }));
    expect(withIt).toContain("/secretariat");
    expect(withoutIt).not.toContain("/secretariat");
  });

  it("filters every gated entry, including those nested in sections", () => {
    const gated = NAV_GROUPS.flatMap((g) => [
      ...g.items,
      ...(g.subGroups ?? []).flatMap((s) => s.items),
    ]).filter((i) => i.permission);
    // The fixture is only meaningful while some entry is actually gated.
    expect(gated.length).toBeGreaterThan(0);

    const bare = new Set(hrefsOf(filterNavGroups({ permissions: [], roles: [] })));
    for (const item of gated) {
      expect(bare.has(item.href), `${item.href} leaked without ${item.permission}`).toBe(false);
    }
  });

  it("drops a section once all of its screens are hidden", () => {
    const groups = filterNavGroups({ permissions: [], roles: [] });
    for (const g of groups) {
      for (const sub of g.subGroups ?? []) {
        expect(sub.items.length, `empty section left in ${sub.titleKey}`).toBeGreaterThan(0);
      }
    }
  });

  it("never invents an entry the raw tree does not contain", () => {
    const raw = new Set(hrefsOf(NAV_GROUPS));
    for (const href of hrefsOf(filterNavGroups(WILDCARD))) {
      expect(raw.has(href)).toBe(true);
    }
  });

  it("gives a department's sections to the cards without a second list", () => {
    const groups = filterNavGroups(WILDCARD);
    const sections = navSectionsFor(groups, "nav.group.general_admin");
    expect(sections.length).toBeGreaterThan(1);
    // What the cards show must be exactly what the menu shows for that group.
    const fromSections = sections.flatMap((s) => s.items.map((i) => i.href)).sort();
    const group = groups.find((g) => g.titleKey === "nav.group.general_admin")!;
    const fromMenu = [
      ...group.items,
      ...(group.subGroups ?? []).flatMap((s) => s.items),
    ]
      .map((i) => i.href)
      .sort();
    // The department's own top-level entries (its dashboard) are not sections.
    expect(fromMenu).toEqual(expect.arrayContaining(fromSections));
    expect(fromSections.length).toBeGreaterThan(0);
  });

  it("returns nothing for a department that does not exist", () => {
    expect(navSectionsFor(filterNavGroups(WILDCARD), "nav.group.nope")).toEqual([]);
  });

  it("resolves a sub-group key, so a breadcrumb inside Finance has a workspace", () => {
    const sections = navSectionsFor(filterNavGroups(WILDCARD), "nav.group.acct_department");
    expect(sections).toHaveLength(1);
    expect(sections[0].items.map((i) => i.href)).toContain("/accounts");
  });
});

/**
 * The home launcher.
 *
 * A department tile is meant to open the department's workspace — Home →
 * department → its screens → the screen. Before this, most tiles opened the
 * department's dashboard instead, which is one screen inside the department
 * rather than the way in to it, and nothing caught the difference because
 * nothing asserted it. These do.
 */
describe("home launcher", () => {
  it("has no tile back to home", () => {
    expect(MODULES.some((m) => m.href === "/")).toBe(false);
  });

  it("leads with General Administration", () => {
    expect(MODULES[0].group).toBe("nav.group.general_admin");
  });

  it("names a real department on every department tile", () => {
    const departments = MODULES.filter((m) => m.group);
    expect(departments.length).toBeGreaterThan(10);
    for (const mod of departments) {
      const slug = departmentPath(mod.group!).slice("/department/".length);
      expect(navGroupTitleKeyForSlug(slug), `${mod.titleKey} names no department`).toBe(mod.group);
    }
  });

  it("opens a workspace that actually has cards on it", () => {
    const groups = filterNavGroups(WILDCARD);
    for (const mod of MODULES.filter((m) => m.group)) {
      const sections = navSectionsFor(groups, mod.group!);
      const items = sections.flatMap((s) => s.items).filter((i) => i.href !== "/");
      expect(items.length, `${mod.group} workspace is empty`).toBeGreaterThan(0);
    }
  });

  it("never sends a department tile straight to a screen", () => {
    // The regression this whole change exists for: a tile whose href is a
    // route rather than a department is a tile that skips the workspace.
    for (const mod of MODULES.filter((m) => m.group)) {
      expect(mod.href, `${mod.titleKey} still carries a direct href`).toBeUndefined();
    }
  });

  it("keeps every tile's destination inside the app", () => {
    const routable = new Set([...hrefsOf(NAV_GROUPS), "/dashboard"]);
    for (const mod of MODULES) {
      const href = mod.group ? departmentPath(mod.group) : mod.href!;
      const ok = href.startsWith("/department/") || routable.has(href);
      expect(ok, `${mod.titleKey} points at ${href}, which nothing serves`).toBe(true);
    }
  });

  it("gives each tile a distinct destination", () => {
    const hrefs = MODULES.map((m) => (m.group ? departmentPath(m.group) : m.href!));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every department and section its own URL", () => {
    // Two keys sharing a slug would put two departments on one address, and
    // whichever the lookup found first would answer for both.
    const keys = NAV_GROUPS.flatMap((g) => [
      g.titleKey,
      ...(g.subGroups ?? []).map((s) => s.titleKey),
    ]);
    const paths = keys.map(departmentPath);
    expect(new Set(paths).size).toBe(keys.length);
  });

  it("makes every breadcrumb department a live link", () => {
    // The breadcrumb builds its middle crumb with departmentPath() from
    // whichever group or sub-group owns the screen. If any of those did not
    // resolve back, that crumb would be a dead link on every screen in it.
    const keys = NAV_GROUPS.flatMap((g) => [
      g.titleKey,
      ...(g.subGroups ?? []).map((s) => s.titleKey),
    ]);
    for (const key of keys) {
      const slug = departmentPath(key).slice("/department/".length);
      expect(navGroupTitleKeyForSlug(slug), `${key} has no workspace`).toBe(key);
    }
  });
});
