import katex from "katex";
import { useMemo } from "react";

export function Tex({ math, block = false, className = "" }: { math: string; block?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(math, { displayMode: block, throwOnError: false, strict: false }),
    [math, block],
  );
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={`${block ? "overflow-x-auto overflow-y-hidden py-1" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
