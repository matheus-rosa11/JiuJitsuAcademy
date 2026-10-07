import { beltLook } from "@/lib/belts";
import { degreeLabel } from "@/lib/format";
import { cn } from "./ui";

const sizes = {
  sm: { belt: "h-3 w-12", tip: "w-4 right-1.5", bar: "w-[2px]" },
  md: { belt: "h-4 w-16", tip: "w-5 right-2", bar: "w-[2px]" },
  lg: { belt: "h-7 w-36", tip: "w-11 right-4", bar: "w-[3px]" },
};

/** A small drawing of the belt, with the degree stripes on the tip. */
export function BeltBadge({ name, degree = 0, size = "md" }: { name: string; degree?: number; size?: keyof typeof sizes }) {
  const look = beltLook(name);
  const s = sizes[size];

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15 dark:ring-white/25", s.belt)}
      style={{ background: look.main }}
      title={`${name} — ${degreeLabel(degree)}`}
    >
      {look.stripe && (
        <div className="absolute inset-x-0 top-1/2 h-[30%] -translate-y-1/2" style={{ background: look.stripe }} />
      )}
      <div className={cn("absolute inset-y-0 flex items-center justify-center gap-[2px]", s.tip)} style={{ background: look.tip }}>
        {Array.from({ length: degree }).map((_, i) => (
          <span key={i} className={cn("h-full bg-white", s.bar)} />
        ))}
      </div>
    </div>
  );
}

export function BeltLabel({ name, degree, size = "md" }: { name: string; degree: number; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2.5">
      <BeltBadge name={name} degree={degree} size={size} />
      <span className={cn("text-zinc-700", size === "sm" ? "text-xs" : "text-sm")}>
        <span className="font-medium text-zinc-900">{name}</span>
        {degree > 0 && <span className="text-zinc-500"> · {degree}º</span>}
      </span>
    </div>
  );
}
