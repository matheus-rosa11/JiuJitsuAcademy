const COLORS: Record<string, string> = {
  Branca: "#f8fafc",
  Cinza: "#9ca3af",
  Amarela: "#facc15",
  Laranja: "#f97316",
  Verde: "#16a34a",
  Azul: "#2563eb",
  Roxa: "#7c3aed",
  Marrom: "#7c4a1e",
  Preta: "#18181b",
};

export interface BeltLook {
  main: string;
  /** Kids' combined belts ("Cinza/Branca") have a horizontal stripe of the second color. */
  stripe?: string;
  /** Black bar where degrees go; red on black belts. */
  tip: string;
}

export function beltLook(name: string): BeltLook {
  const [base, stripe] = name.split("/");
  const main = COLORS[base] ?? "#d4d4d8";
  return {
    main,
    stripe: stripe ? COLORS[stripe] : undefined,
    tip: base === "Preta" ? "#dc2626" : "#18181b",
  };
}
