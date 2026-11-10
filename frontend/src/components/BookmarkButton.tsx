import { Bookmark, BookmarkCheck } from "lucide-react";
import { useLocation } from "react-router";
import { type ModuleKey, useProgress } from "@/services/progressStore";
import { Button } from "./ui/Button";

export function BookmarkButton({ title, module }: { title: string; module: ModuleKey }) {
  const { pathname } = useLocation();
  const saved = useProgress((s) => Boolean(s.bookmarks[pathname]));
  const toggle = useProgress((s) => s.toggleBookmark);
  return (
    <Button
      size="sm"
      variant={saved ? "primary" : "secondary"}
      aria-pressed={saved}
      icon={saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      onClick={() => toggle({ path: pathname, title, module })}
    >
      {saved ? "Bookmarked" : "Bookmark"}
    </Button>
  );
}
