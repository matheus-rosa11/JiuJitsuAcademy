import type { Graduation } from "@/lib/api";
import { beltLook } from "@/lib/belts";
import { formatDateShort } from "@/lib/format";
import { BeltBadge } from "./BeltBadge";
import { Badge, cn } from "./ui";

function title(g: Graduation) {
  if (g.changeType === "Degree") return `${g.beltName} — ${g.degree}º grau`;
  return g.degree > 0 ? `${g.beltName} — ${g.degree}º grau` : g.beltName;
}

/** Newest first. Belt changes get a larger marker in the belt color; degree changes a small dot. */
export function GraduationTimeline({ graduations }: { graduations: Graduation[] }) {
  return (
    <ol className="relative">
      {graduations.map((g, i) => {
        const isBelt = g.changeType === "Belt";
        const last = i === graduations.length - 1;
        return (
          <li key={g.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-zinc-200" />}
            <span
              className={cn(
                "relative z-10 mt-1 flex shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                isBelt ? "size-6" : "ml-1.5 mr-1.5 mt-2 size-3 bg-zinc-300",
              )}
              style={isBelt ? { background: beltLook(g.beltName).main, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" } : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{formatDateShort(g.date)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <BeltBadge name={g.beltName} degree={g.degree} />
                <span className={cn("text-sm", isBelt ? "font-semibold text-zinc-900" : "font-medium text-zinc-700")}>{title(g)}</span>
                {isBelt && <Badge tone="violet">Nova faixa</Badge>}
                {g.changeType === "Degree" && <Badge>Grau</Badge>}
                {g.changeType === "Initial" && <Badge tone="blue">Início</Badge>}
              </div>
              {g.notes && <p className="mt-1 text-sm text-zinc-500">{g.notes}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
