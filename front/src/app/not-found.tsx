import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-5xl font-semibold">404</p>
      <p className="text-zinc-500">Página não encontrada.</p>
      <Link href="/" className="mt-2 text-sm font-medium underline">
        Voltar ao dashboard
      </Link>
    </div>
  );
}
