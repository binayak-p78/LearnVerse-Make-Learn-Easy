import { BookOpen, ChevronDown, FlaskConical, Home, Menu, Moon, Search, Sun, X } from "lucide-react";
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Skeleton } from "@/components/ui/Card";
import { useDismiss } from "@/hooks/useDismiss";
import { useApplyTheme } from "@/hooks/useTheme";
import { useSettings } from "@/services/settingsStore";
import { MODULES, type ModuleInfo } from "./modules";

type NavEntry =
  | { kind: "link"; label: string; to: string; icon: typeof Home }
  | { kind: "menu"; label: string; group: ModuleInfo["group"] };

const NAV: NavEntry[] = [
  { kind: "link", label: "Overview", to: "/", icon: Home },
  { kind: "menu", label: "Simulators", group: "Simulators" },
  { kind: "menu", label: "Automata", group: "Theory of Computation" },
  { kind: "link", label: "NCERT Maths", to: "/ncert", icon: BookOpen },
  { kind: "link", label: "Lab", to: "/lab", icon: FlaskConical },
];

const GROUPS = ["Simulators", "Theory of Computation", "Learn"] as const;

const pill = (active: boolean) =>
  `flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors xl:px-5 ${
    active ? "bg-nav-active text-on-nav-active shadow-sm" : "text-nav-ink hover:text-white"
  }`;

function NavMenu({ label, group }: { label: string; group: ModuleInfo["group"] }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  const items = MODULES.filter((m) => m.group === group);
  const current = items.find((m) => pathname.startsWith(m.path));

  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className={pill(Boolean(current))}>
        {current && <current.icon size={16} aria-hidden />}
        {current?.short ?? label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-3 w-80 -translate-x-1/2 rounded-3xl border border-line/70 bg-surface-2 p-2 shadow-xl">
          {items.map((m) => (
            <Link
              key={m.key}
              to={m.path}
              onClick={close}
              className={`flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-surface ${current?.key === m.key ? "bg-surface" : ""}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <m.icon size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{m.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{m.description}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MainNav() {
  return (
    <nav aria-label="Main" className="flex items-center gap-1 rounded-full bg-nav p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]">
      {NAV.map((entry) =>
        entry.kind === "link" ? (
          <NavLink key={entry.to} to={entry.to} end={entry.to === "/"} className={({ isActive }) => pill(isActive)}>
            {({ isActive }) => (
              <>
                {isActive && <entry.icon size={16} aria-hidden />}
                {entry.label}
              </>
            )}
          </NavLink>
        ) : (
          <NavMenu key={entry.group} label={entry.label} group={entry.group} />
        ),
      )}
    </nav>
  );
}

function DrawerNav({ onNavigate }: { onNavigate: () => void }) {
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
    }`;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      <NavLink to="/" end className={item} onClick={onNavigate}>
        <Home size={18} aria-hidden /> Overview
      </NavLink>
      {GROUPS.map((group) => (
        <div key={group} className="mt-4">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{group}</p>
          <div className="flex flex-col gap-1">
            {MODULES.filter((m) => m.group === group).map((m) => (
              <NavLink key={m.key} to={m.path} className={item} onClick={onNavigate}>
                <m.icon size={18} aria-hidden />
                <span className="truncate">{m.short}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function RoundButton({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`card-edge flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink shadow-card transition-colors hover:bg-surface ${className}`}
    >
      {children}
    </button>
  );
}

function ThemeSwitch() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const dark = theme === "dark";
  return (
    <RoundButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </RoundButton>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="MAKE LEARN EASY home">
      <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-[10px] dark:ring-1 dark:ring-white/15" />
      <span className="hidden leading-none sm:block">
        <span className="block text-[15px] font-bold tracking-tight">Make Learn Easy</span>
        <span className="mt-1 block text-[11px] font-medium text-muted">Learn by doing</span>
      </span>
    </Link>
  );
}

function Profile() {
  return (
    <div className="card-edge hidden h-11 shrink-0 items-center gap-2.5 rounded-full bg-surface-2 py-1 pl-1 pr-4 shadow-card sm:flex">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-xs font-bold text-on-lime" aria-hidden>
        ST
      </span>
      <span className="leading-none">
        <span className="block text-sm font-semibold">Student</span>
        <span className="mt-1 block text-[11px] text-muted">Class 11–12</span>
      </span>
    </div>
  );
}

// Jumps to any module, or hands the query to the NCERT lesson search
function QuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);
  const term = query.trim().toLowerCase();

  const results = useMemo(() => {
    const modules = MODULES.filter((m) => !term || m.title.toLowerCase().includes(term) || m.description.toLowerCase().includes(term))
      .slice(0, 6)
      .map((m) => ({ key: m.key, label: m.title, hint: m.group, icon: m.icon, to: m.path }));
    return term.length >= 2
      ? [...modules, { key: "lessons", label: `Search lessons for “${query.trim()}”`, hint: "NCERT", icon: BookOpen, to: `/ncert?q=${encodeURIComponent(query.trim())}` }]
      : modules;
  }, [term, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    navigate(to);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={box} className="relative w-full">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="quick-search-results"
        aria-label="Search modules and lessons"
        placeholder="Search lessons…"
        className="card-edge h-11 w-full rounded-full bg-surface-2 pl-10 pr-12 text-sm shadow-card placeholder:text-muted/80 focus:border-ink/30 focus:outline-none"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === "Enter" && results[active]) go(results[active].to);
        }}
      />
      <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-surface px-1.5 font-mono text-[10px] text-muted sm:block">⌘K</kbd>
      {open && results.length > 0 && (
        <ul id="quick-search-results" role="listbox" className="absolute left-0 right-0 top-[52px] z-50 min-w-72 overflow-hidden rounded-3xl border border-line/70 bg-surface-2 p-1.5 shadow-xl">
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.to)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm ${i === active ? "bg-surface" : ""}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><r.icon size={15} aria-hidden /></span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                <span className="text-[11px] text-muted">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export function Layout() {
  useApplyTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col rounded-r-[28px] bg-surface py-5 shadow-xl">
            <div className="flex items-center justify-between px-5">
              <Brand />
              <RoundButton label="Close navigation" onClick={() => setDrawerOpen(false)}>
                <X size={18} />
              </RoundButton>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <DrawerNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <header className="no-print sticky top-0 z-30 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <RoundButton label="Open navigation" onClick={() => setDrawerOpen(true)} className="lg:hidden">
            <Menu size={18} />
          </RoundButton>
          <Brand />
          <div className="hidden flex-1 justify-center lg:flex">
            <MainNav />
          </div>
          <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
            <div className="hidden w-52 md:block xl:w-64">
              <QuickSearch />
            </div>
            <ThemeSwitch />
            <Profile />
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <QuickSearch />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 pt-3 sm:px-6 lg:pt-5">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
