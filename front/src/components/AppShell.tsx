"use client";

import { Award, CalendarCheck, LayoutDashboard, School, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", short: "Início", icon: LayoutDashboard },
  { href: "/alunos", label: "Alunos", short: "Alunos", icon: Users },
  { href: "/turmas", label: "Turmas", short: "Turmas", icon: School },
  { href: "/presenca", label: "Presença", short: "Presença", icon: CalendarCheck },
  { href: "/graduacoes", label: "Graduações", short: "Faixas", icon: Award },
  { href: "/financeiro", label: "Financeiro", short: "Financeiro", icon: Wallet },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-white">
        <div className="relative h-2.5 w-6 rounded-[2px] bg-zinc-900">
          <div className="absolute inset-y-0 right-1 w-2 bg-red-600" />
        </div>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Tatame</p>
        <p className="text-xs text-zinc-400">Gestão de academia</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh bg-zinc-50">
      <aside className="palette-fixed fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-zinc-950 px-4 py-6 dark:border-r dark:border-white/5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(href) ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-3">
          <ThemeToggle />
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-3 text-xs text-zinc-400">
          <p className="font-medium text-zinc-200">Versão de demonstração</p>
          <p className="mt-0.5">Dados fictícios para validação.</p>
        </div>
      </aside>

      <header className="palette-fixed sticky top-0 z-30 flex h-14 items-center justify-between bg-zinc-950 pl-4 pr-2 dark:border-b dark:border-white/5 lg:hidden">
        <Logo />
        <ThemeToggle variant="icon" />
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-zinc-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              isActive(href) ? "text-zinc-900" : "text-zinc-400",
            )}
          >
            <Icon className="size-5" />
            {short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
