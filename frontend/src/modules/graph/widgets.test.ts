import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildScope, missingParams, parseRow, userFunctionName } from "./parse";

const NCERT = join(__dirname, "../../../../backend/content/ncert");

interface Widget {
  module: string;
  label: string;
  params: Record<string, string>;
}

const widgets: { where: string; widget: Widget }[] = [];
for (const dir of readdirSync(NCERT).filter((d) => d.startsWith("class-"))) {
  for (const file of readdirSync(join(NCERT, dir))) {
    const chapter = JSON.parse(readFileSync(join(NCERT, dir, file), "utf8"));
    for (const topic of chapter.topics) {
      if (topic.widget?.module === "graph") widgets.push({ where: `${chapter.id}/${topic.id}`, widget: topic.widget });
    }
  }
}

describe("NCERT graph widgets", () => {
  it("exist", () => expect(widgets.length).toBeGreaterThan(5));

  for (const { where, widget } of widgets) {
    it(`${where} parses cleanly`, () => {
      const texts = Object.values(widget.params);
      const functions = new Set(texts.map(userFunctionName).filter((n): n is string => n !== null));
      const items = texts.map((t) => parseRow(t, functions));
      const scope = buildScope(items);
      items.forEach((item, i) => {
        expect(item.kind, texts[i]).not.toBe("error");
        expect(missingParams(item, scope), texts[i]).toEqual([]);
      });
    });
  }
});
