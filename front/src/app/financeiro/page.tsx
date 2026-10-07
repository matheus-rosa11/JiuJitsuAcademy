"use client";

import { ChevronLeft, ChevronRight, Plus, Receipt, Search, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { PaymentModal } from "@/components/PaymentModal";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, cn, EmptyState, ErrorState, Input, PageHeader, ProgressBar, Segmented, Spinner } from "@/components/ui";
import { api, type FinanceSummary, type Payment, type PaymentStatus } from "@/lib/api";
import { formatCurrency, formatDate, monthName, paymentStatusLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const statusTone = { Paid: "green", Pending: "amber", Overdue: "red" } as const;
type StatusFilter = "all" | PaymentStatus;

function Summary({ label, value, tone, children }: { label: string; value: number; tone?: string; children?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", tone)}>{formatCurrency(value)}</p>
      {children}
    </Card>
  );
}

function FinancePage() {
  const params = useSearchParams();
  const toast = useToast();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) ?? "all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ payment?: Payment } | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: summary, reload: reloadSummary } = useApi<FinanceSummary>(`/payments/summary?year=${period.year}&month=${period.month}`);

  // Overdue spans every month, so that filter ignores the selected month.
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (status !== "Overdue") {
    query.set("year", String(period.year));
    query.set("month", String(period.month));
  }
  const { data: payments, error, reload, loading } = useApi<Payment[]>(`/payments?${query}`);

  const term = search.trim().toLowerCase();
  const visible = (payments ?? []).filter((p) => p.studentName.toLowerCase().includes(term));
  const collected = summary && summary.expectedRevenue > 0 ? (summary.received / summary.expectedRevenue) * 100 : 0;

  function refresh() {
    reload();
    reloadSummary();
  }

  function shiftMonth(delta: number) {
    setPeriod(({ year, month }) => {
      const d = new Date(year, month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }

  async function markPaid(p: Payment) {
    try {
      await api(`/payments/${p.id}/mark-paid`, { method: "POST", body: {} });
      toast(`Pagamento de ${p.studentName} recebido.`);
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(p: Payment) {
    if (!confirm(`Excluir o lançamento de ${p.studentName} (${formatCurrency(p.amount)})?`)) return;
    try {
      await api(`/payments/${p.id}`, { method: "DELETE" });
      toast("Lançamento excluído.");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const result = await api<{ created: number }>("/payments/generate", { method: "POST", body: { year: period.year, month: period.month, dueDay: 10 } });
      toast(result.created > 0 ? `${result.created} mensalidades geradas para ${monthName(period.month).toLowerCase()}.` : "Todos os alunos ativos já têm mensalidade neste mês.");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Controle de mensalidades. Sem cobrança online — apenas registro."
        actions={
          <>
            <Button variant="secondary" onClick={generate} loading={generating}>
              <Sparkles className="size-4" />
              Gerar mensalidades do mês
            </Button>
            <Button onClick={() => setModal({})}>
              <Plus className="size-4" />
              Novo pagamento
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-40 text-center font-semibold text-zinc-900">
          {monthName(period.month)} {period.year}
        </p>
        <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Receita prevista" value={summary.expectedRevenue}>
            <p className="mt-1 text-xs text-zinc-500">Mensalidades dos alunos ativos</p>
          </Summary>
          <Summary label="Recebido no mês" value={summary.received} tone="text-emerald-600">
            <ProgressBar className="mt-2" value={collected} tone="green" />
            <p className="mt-1.5 text-xs text-zinc-500">{Math.round(collected)}% do previsto</p>
          </Summary>
          <Summary label="Pendente (a vencer)" value={summary.pending} tone="text-amber-600" />
          <Summary label="Em atraso (total)" value={summary.overdue} tone="text-red-600">
            <p className="mt-1 text-xs text-zinc-500">
              {summary.overdueCount} {summary.overdueCount === 1 ? "mensalidade" : "mensalidades"}
            </p>
          </Summary>
        </div>
      )}

      <Card className="mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "Paid", label: "Pagos" },
            { value: "Pending", label: "Pendentes" },
            { value: "Overdue", label: "Em atraso" },
          ]}
        />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-10" placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>
      {status === "Overdue" && <p className="mb-3 text-sm text-zinc-500">Mostrando atrasos de todos os meses.</p>}

      {error && !payments ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !payments ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="Nenhum lançamento"
            description={status === "all" ? "Gere as mensalidades do mês para começar o controle." : "Nenhum lançamento com esse filtro."}
          />
        </Card>
      ) : (
        <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <ul className="divide-y divide-zinc-100">
            {visible.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setModal({ payment: p })}>
                  <p className="truncate font-medium text-zinc-900">{p.studentName}</p>
                  <p className="text-xs text-zinc-500">
                    Vence {formatDate(p.dueDate)}
                    {p.paidAt && ` · pago em ${formatDate(p.paidAt)}`}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </button>
                <span className="font-semibold tabular-nums text-zinc-900">{formatCurrency(p.amount)}</span>
                <Badge tone={statusTone[p.status]}>{paymentStatusLabel[p.status]}</Badge>
                <div className="flex items-center gap-1">
                  {p.status !== "Paid" && (
                    <Button size="sm" variant="success" onClick={() => markPaid(p)}>
                      Recebido
                    </Button>
                  )}
                  <button onClick={() => remove(p)} className="cursor-pointer rounded-lg p-2 text-zinc-300 hover:bg-red-50 hover:text-red-600" aria-label="Excluir">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-zinc-400">
        A mensalidade de cada aluno é definida no <Link href="/alunos" className="underline">cadastro do aluno</Link>.
      </p>

      {modal && (
        <PaymentModal
          payment={modal.payment}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <FinancePage />
    </Suspense>
  );
}
