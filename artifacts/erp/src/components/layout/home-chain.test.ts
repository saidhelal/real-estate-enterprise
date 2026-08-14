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
 * The chain the launcher promises: Home → department → its screens → a screen.
 *
 * Each step is walked here the way the app walks it — a tile's destination is
 * resolved to a department, the department's workspace is built from the same
 * SSOT the page uses, and every card it produces is checked to be a real
 * screen. A tile that skipped a step used to be invisible until someone
 * clicked it.
 */

const WILDCARD = { permissions: ["*"], roles: ["Super Administrator"] };

/** Every screen href the navigation tree contains, at any depth. */
const ROUTABLE = new Set(
  NAV_GROUPS.flatMap((g) => [
    ...g.items.map((i) => i.href),
    ...(g.subGroups ?? []).flatMap((s) => s.items.map((i) => i.href)),
  ]),
);

describe("home → department → screen", () => {
  const groups = filterNavGroups(WILDCARD);

  for (const mod of MODULES.filter((m) => m.group)) {
    it(`${mod.titleKey} opens its department, not a screen`, () => {
      // Step 1: the tile's destination is a department workspace.
      const path = departmentPath(mod.group!);
      expect(path.startsWith("/department/")).toBe(true);

      // Step 2: that address resolves back to this exact department.
      const slug = path.slice("/department/".length);
      expect(navGroupTitleKeyForSlug(slug)).toBe(mod.group);

      // Step 3: the workspace has function cards on it.
      const sections = navSectionsFor(groups, mod.group!);
      const items = sections.flatMap((s) => s.items).filter((i) => i.href !== "/");
      expect(items.length).toBeGreaterThan(0);

      // Step 4: every card opens a real screen, and none of them loops back
      // to the workspace or to home.
      for (const item of items) {
        expect(ROUTABLE.has(item.href), `${item.href} is not a screen`).toBe(true);
        expect(item.href.startsWith("/department/")).toBe(false);
        expect(item.href).not.toBe("/");
      }
    });
  }

  it("keeps each department's dashboard as one of its cards, not its front door", () => {
    // The specific regression: a tile that landed on the dashboard made the
    // dashboard the only screen the department appeared to have.
    const withDashboard = MODULES.filter((m) => m.group).filter((mod) => {
      const items = navSectionsFor(groups, mod.group!).flatMap((s) => s.items);
      return items.some((i) => i.href.endsWith("-dashboard"));
    });
    expect(withDashboard.length).toBeGreaterThan(5);
    for (const mod of withDashboard) {
      expect(departmentPath(mod.group!)).not.toMatch(/-dashboard$/);
    }
  });
});
