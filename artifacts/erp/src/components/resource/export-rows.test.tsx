import { describe, it, expect } from "vitest";
import { Badge } from "@/components/ui/badge";
import { cellText } from "./export-rows";

/**
 * Reading a rendered cell back as text.
 *
 * The export takes its cells from the same `render` the table uses, so no
 * screen describes its columns twice. That only works if the reading is
 * faithful: a badge must export its label, a conditional cell that renders
 * nothing must export nothing, and React's ways of saying "nothing" —
 * `null`, `undefined`, `false` — must not arrive in the spreadsheet as words.
 */

describe("cellText", () => {
  it("keeps plain strings and numbers", () => {
    expect(cellText("Villa 12")).toBe("Villa 12");
    expect(cellText(1250)).toBe("1250");
    expect(cellText(0)).toBe("0"); // not "" — zero is a value
  });

  it("renders nothing for React's several kinds of nothing", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
    expect(cellText(false)).toBe("");
    // The shape a conditional cell takes: `{row.note && <span>{row.note}</span>}`
    const note = "";
    expect(cellText(note && <span>{note}</span>)).toBe("");
  });

  it("reads the label out of a badge", () => {
    expect(cellText(<Badge>Active</Badge>)).toBe("Active");
  });

  it("reads through nested elements", () => {
    expect(
      cellText(
        <div>
          <span>Ahmed</span> <span className="text-muted-foreground">(Sales)</span>
        </div>,
      ),
    ).toBe("Ahmed (Sales)");
  });

  it("joins fragment children without collapsing them together", () => {
    expect(cellText([<span key="a">12</span>, <span key="b">units</span>])).toBe("12 units");
  });

  it("drops an icon-only cell rather than exporting a symbol", () => {
    // An icon carries no text, so there is nothing to put in a cell.
    expect(cellText(<svg viewBox="0 0 24 24" />)).toBe("");
  });

  it("survives a cell built from a formatted number", () => {
    expect(cellText(<span className="tabular-nums">{(1250).toLocaleString("en-US")}</span>)).toBe(
      "1,250",
    );
  });
});
