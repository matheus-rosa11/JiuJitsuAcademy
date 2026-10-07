"use client";

import type { Belt } from "@/lib/api";
import { BeltBadge } from "./BeltBadge";
import { cn } from "./ui";

/** Shows only the belts it receives; callers always load them filtered by student type. */
export function BeltPicker({ belts, value, onChange }: { belts: Belt[]; value: string; onChange: (beltId: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {belts.map((belt) => (
        <button
          key={belt.id}
          type="button"
          onClick={() => onChange(belt.id)}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition-all",
            value === belt.id ? "bg-zinc-900 text-zinc-50 ring-zinc-900" : "bg-surface text-zinc-700 ring-zinc-200 hover:ring-zinc-400",
          )}
        >
          <BeltBadge name={belt.name} size="sm" />
          <span className="truncate font-medium">{belt.name}</span>
        </button>
      ))}
    </div>
  );
}

export function DegreePicker({ max, value, onChange }: { max: number; value: number; onChange: (degree: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: max + 1 }).map((_, degree) => (
        <button
          key={degree}
          type="button"
          onClick={() => onChange(degree)}
          className={cn(
            "h-11 min-w-11 cursor-pointer rounded-xl px-3 text-sm font-medium ring-1 transition-all",
            value === degree ? "bg-zinc-900 text-zinc-50 ring-zinc-900" : "bg-surface text-zinc-700 ring-zinc-200 hover:ring-zinc-400",
          )}
        >
          {degree === 0 ? "Sem grau" : `${degree}º`}
        </button>
      ))}
    </div>
  );
}
