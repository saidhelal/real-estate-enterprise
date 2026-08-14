import { describe, it, expect } from "vitest";
import { NAV_GROUPS, filterNavGroups, navSectionsFor } from "./app-shell";

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
});
