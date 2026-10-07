"use client";

import { ArrowRight, Award, CalendarCheck, TrendingUp, TriangleAlert, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BeltBadge } from "@/components/BeltBadge";
import { Badge, buttonClass, Card, CardHeader, ErrorState, ProgressBar, Spinner, rateTone } from "@/components/ui";
import type { Dashboard } from "@/lib/api";
import { formatCurrency, formatDateShort, monthName, WEEKDAYS_FULL } from "@/lib/format";
import { useApi } from "@/lib/useApi";

function Stat({ label, value, sub, icon, children }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; children?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-zinc-500">{label}</p>
        <div className="rounded-xl bg-zinc-100 p-2 text-zinc-600">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{value}</p>
      {sub && <div className="mt-1 text-sm text-zinc-500">{sub}</div>}
      {children}
    </Card>
  );
}

function BeltDistribution({ title, items }: { title: string; items: Dashboard["adultBelts"] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card className="pb-5">
      <CardHeader title={title} />
      <ul className="mt-4 space-y-2.5 px-5">
        {items.map((b) => (
          <li key={b.beltId}>
            <Link href={`/alunos?belt=${b.beltId}`} className="group flex items-center gap-3">
              <BeltBadge name={b.beltName} size="sm" />
              <span className="w-28 shrink-0 truncate text-sm text-zinc-700 group-hover:text-zinc-900">{b.beltName}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-zinc-800" style={{ width: `${(b.count / max) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-sm font-semibold tabular-nums text-zinc-900">{b.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, error, reload } = useApi<Dashboard>("/dashboard");

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  const { students, finance, attendance } = data;
  const collected = finance.expectedRevenue > 0 ? (finance.received / finance.expectedRevenue) * 100 : 0;
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {WEEKDAYS_FULL[today.getDay()]}, {today.getDate()} de {monthName(today.getMonth() + 1).toLowerCase()}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bom treino, professor 👊</h1>
        </div>
        <Link href="/presenca" className={buttonClass({ size: "lg", className: "w-full sm:w-auto" })}>
          <CalendarCheck className="size-5" />
          Fazer chamada
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Alunos ativos"
          value={students.active}
          icon={<Users className="size-4" />}
          sub={
            <span>
              {students.adults} adultos · {students.children} infantis
            </span>
          }
        />
        <Stat
          label={`Receita prevista · ${monthName(finance.month)}`}
          value={formatCurrency(finance.expectedRevenue)}
          icon={<TrendingUp className="size-4" />}
          sub="Soma das mensalidades ativas"
        />
        <Stat label="Recebido no mês" value={formatCurrency(finance.received)} icon={<Wallet className="size-4" />}>
          <div className="mt-3 space-y-1.5">
            <ProgressBar value={collected} tone="green" />
            <p className="text-xs text-zinc-500">
              {Math.round(collected)}% do previsto · {formatCurrency(finance.pending)} a vencer
            </p>
          </div>
        </Stat>
        <Stat
          label="Em atraso"
          value={<span className={finance.overdue > 0 ? "text-red-600" : undefined}>{formatCurrency(finance.overdue)}</span>}
          icon={<TriangleAlert className="size-4" />}
          sub={
            <Link href="/financeiro?status=Overdue" className="inline-flex items-center gap-1 hover:text-zinc-900">
              {finance.overdueCount} {finance.overdueCount === 1 ? "mensalidade" : "mensalidades"} <ArrowRight className="size-3.5" />
            </Link>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-500">Presença média · 30 dias</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{attendance.averageRate.toFixed(0)}%</p>
          <ProgressBar className="mt-3" value={attendance.averageRate} tone={rateTone(attendance.averageRate)} />
          <p className="mt-3 text-sm text-zinc-500">{attendance.presencesLast30Days} presenças registradas no período</p>
          <Link href="/presenca?tab=frequencia" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-900 hover:underline">
            Ver frequência por aluno <ArrowRight className="size-4" />
          </Link>
        </Card>

        <Card className="pb-3 lg:col-span-2">
          <CardHeader title="Alunos com baixa frequência" icon={<TriangleAlert className="size-4 text-amber-500" />} action={<Badge tone="amber">abaixo de 60%</Badge>} />
          {attendance.lowAttendance.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">Ninguém abaixo de 60% nos últimos 30 dias. 🎉</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {attendance.lowAttendance.map((s) => (
                <li key={s.studentId}>
                  <Link href={`/alunos/${s.studentId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50">
                    <span className="flex-1 truncate text-sm font-medium text-zinc-900">{s.name}</span>
                    <span className="hidden text-xs text-zinc-500 sm:block">
                      {s.presences}/{s.sessions} aulas
                    </span>
                    <div className="w-24">
                      <ProgressBar value={s.rate} tone={rateTone(s.rate)} />
                    </div>
                    <span className="w-12 text-right text-sm font-semibold tabular-nums text-red-600">{s.rate.toFixed(0)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BeltDistribution title="Faixas · Adulto" items={data.adultBelts} />
        <BeltDistribution title="Faixas · Infantil" items={data.childBelts} />
        <Card className="pb-3">
          <CardHeader
            title="Graduações recentes"
            icon={<Award className="size-4 text-violet-500" />}
            action={
              <Link href="/graduacoes" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                Ver todas
              </Link>
            }
          />
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.recentGraduations.map((g) => (
              <li key={g.id}>
                <Link href={`/alunos/${g.studentId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50">
                  <BeltBadge name={g.beltName} degree={g.degree} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{g.studentName}</p>
                    <p className="text-xs text-zinc-500">
                      {g.changeType === "Belt" ? `Nova faixa ${g.beltName}` : `${g.beltName} · ${g.degree}º grau`}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">{formatDateShort(g.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
