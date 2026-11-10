import { api, type Schemas, unwrap } from "@/services/api";

export type ClassSummary = Schemas["ClassSummary"];
export type ClassDetail = Schemas["ClassDetail"];
export type Chapter = Schemas["ChapterPublic"];
export type Topic = Schemas["TopicPublic"];
export type SearchHit = Schemas["SearchHit"];

export const fetchClasses = () => unwrap(api.GET("/api/content/classes"));

export const fetchClass = (grade: number) =>
  unwrap(api.GET("/api/content/classes/{grade}", { params: { path: { grade } } }));

export const fetchChapter = (chapterId: string) =>
  unwrap(api.GET("/api/content/chapters/{chapter_id}", { params: { path: { chapter_id: chapterId } } }));

export const searchContent = (q: string, grade?: number) =>
  unwrap(api.GET("/api/content/search", { params: { query: { q, grade } } }));

export function widgetHref(widget: NonNullable<Topic["widget"]>): string {
  const base = { graph: "/graph", calculus: "/calculus", projectile: "/projectile", lab: "/lab" }[widget.module];
  const params = new URLSearchParams();
  // Graph widgets list expressions as e1, e2, … which become repeated ?e= values
  for (const [key, value] of Object.entries(widget.params ?? {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    params.append(widget.module === "graph" && /^e\d+$/.test(key) ? "e" : key, value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
