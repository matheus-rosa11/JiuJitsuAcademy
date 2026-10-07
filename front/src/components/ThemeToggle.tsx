"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect, type MouseEvent } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/** Same logic as themeScript (lib/theme.ts). */
function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

function switchTheme(origin: HTMLElement) {
  const root = document.documentElement;
  const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTheme(next);
    return;
  }

  if (!document.startViewTransition) {
    root.dataset.themeFade = "";
    setTheme(next);
    setTimeout(() => delete root.dataset.themeFade, 350);
    return;
  }

  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  document.startViewTransition(() => setTheme(next)).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

function ThemeIcon() {
  return (
    <span className="relative size-5 shrink-0">
      <Sun className="absolute inset-0 size-5 transition-all duration-500 ease-out dark:-rotate-90 dark:scale-0 dark:opacity-0" />
      <Moon className="absolute inset-0 size-5 rotate-90 scale-0 opacity-0 transition-all duration-500 ease-out dark:rotate-0 dark:scale-100 dark:opacity-100" />
    </span>
  );
}

/** Lives inside the always-dark chrome (sidebar / mobile header). */
export function ThemeToggle({ variant = "row" }: { variant?: "row" | "icon" }) {
  // React resets <html> attributes on the dev Strict Mode remount; re-apply before paint (no-op in production).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = preferredTheme();
  }, []);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => switchTheme(e.currentTarget);

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Alternar modo escuro"
        className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ThemeIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar modo escuro"
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
    >
      <ThemeIcon />
      <span className="flex-1 text-left">Modo escuro</span>
      <span className="relative h-5 w-9 rounded-full bg-white/15 transition-colors duration-300 dark:bg-emerald-500">
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out dark:translate-x-4" />
      </span>
    </button>
  );
}
