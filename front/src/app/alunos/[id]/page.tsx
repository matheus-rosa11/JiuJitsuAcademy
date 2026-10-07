"use client";

import { ArrowLeft, Award, CalendarCheck, Mail, Pencil, Phone, Plus, Star, UserCheck, UserX, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BeltBadge } from "@/components/BeltBadge";
import { GraduationModal } from "@/components/GraduationModal";
import { GraduationTimeline } from "@/components/GraduationTimeline";
import { PaymentModal } from "@/components/PaymentModal";
import { useToast } from "@/components/Toast";
import { Avatar, Badge, Button, buttonClass, Card, CardHeader, ErrorState, ProgressBar, Spinner, rateTone } from "@/components/ui";
import { api, type Payment, type StudentDetail } from "@/lib/api";
import { degreeLabel, formatCurrency, formatDate, paymentStatusLabel, studentTypeLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const paymentTone = { Paid: "green", Pending: "amber", Overdue: "red" } as const;

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: student, error, reload } = useApi<StudentDetail>(`/students/${id}`);
  const [graduating, setGraduating] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ payment?: Payment } | null>(null);

  if (error && !student) return <ErrorState message={error} onRetry={reload} />;
  if (!student) return <Spinner />;

  async function setActive(active: boolean) {
    try {
      if (active) {
        await api(`/students/${id}`, {
          method: "PUT",
          body: {
            ...student!,
            active: true,
            classIds: student!.classes.map((c) => c.id),
            responsibles: student!.responsibles.map((r) => ({ responsibleId: r.responsibleId, relationship: r.relationship, isPrimary: r.isPrimary })),
          },
        });
      } else {
        await api(`/students/${id}`, { method: "DELETE" });
      }
      toast(active ? "Aluno reativado." : "Aluno desativado. O histórico foi mantido.");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function markPaid(payment: Payment) {
    try {
      await api(`/payments/${payment.id}/mark-paid`, { method: "POST", body: {} });
      toast("Pagamento marcado como pago.");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const { attendance } = student;

  return (
    <div className="space-y-5">
      <Link href="/alunos" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> Alunos
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <Avatar name={student.name} size="lg" tone={student.studentType === "Child" ? "sky" : "zinc"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{student.name}</h1>
              <Badge tone={student.studentType === "Child" ? "blue" : "zinc"}>{studentTypeLabel(student.studentType)}</Badge>
              {student.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {student.age} anos · treina desde {formatDate(student.joinedAt)}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <BeltBadge name={student.beltName} degree={student.currentDegree} size="lg" />
              <div>
                <p className="font-semibold text-zinc-900">Faixa {student.beltName}</p>
                <p className="text-sm text-zinc-500">{degreeLabel(student.currentDegree)}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <Button onClick={() => setGraduating(true)} disabled={!student.active}>
              <Award className="size-4" />
              Registrar graduação
            </Button>
            <Link href={`/alunos/${id}/editar`} className={buttonClass({ variant: "secondary" })}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-500">Contato</p>
          <div className="mt-3 space-y-2 text-sm">
            {student.email || student.phone ? (
              <>
                {student.email && (
                  <a href={`mailto:${student.email}`} className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900">
                    <Mail className="size-4 text-zinc-400" /> {student.email}
                  </a>
                )}
                {student.phone && (
                  <a href={`tel:${student.phone}`} className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900">
                    <Phone className="size-4 text-zinc-400" /> {student.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="text-zinc-500">{student.studentType === "Child" ? "Contato pelos responsáveis." : "Sem contato cadastrado."}</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Mensalidade</p>
            <Wallet className="size-4 text-zinc-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(student.monthlyFee)}</p>
          <div className="mt-2">
            {student.paymentStatus === "Overdue" ? <Badge tone="red">Em atraso</Badge> : <Badge tone="green">Em dia</Badge>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Frequência · 30 dias</p>
            <CalendarCheck className="size-4 text-zinc-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{attendance.sessionsLast30Days > 0 ? `${attendance.rateLast30Days.toFixed(0)}%` : "—"}</p>
          <ProgressBar className="mt-2" value={attendance.rateLast30Days} tone={rateTone(attendance.rateLast30Days)} />
          <p className="mt-2 text-xs text-zinc-500">
            {attendance.presencesLast30Days} de {attendance.sessionsLast30Days} aulas · {attendance.totalPresences} presenças no total
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card className="pb-6">
            <CardHeader title="Histórico de graduação" icon={<Award className="size-4 text-violet-500" />} />
            <div className="mt-5 px-5">
              <GraduationTimeline graduations={student.graduations} />
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {student.studentType === "Child" && (
            <Card className="pb-3">
              <CardHeader title="Responsáveis" icon={<Users className="size-4 text-zinc-400" />} />
              {student.responsibles.length === 0 ? (
                <p className="px-5 py-6 text-sm text-zinc-500">Nenhum responsável cadastrado.</p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-100">
                  {student.responsibles.map((r) => (
                    <li key={r.responsibleId} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900">{r.name}</p>
                        {r.isPrimary && (
                          <Badge tone="amber">
                            <Star className="size-3 fill-current" /> Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500">{r.relationship}</p>
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="mt-1 flex items-center gap-1.5 text-sm text-zinc-700 hover:text-zinc-900">
                          <Phone className="size-3.5 text-zinc-400" /> {r.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="p-5">
            <p className="text-sm font-semibold text-zinc-900">Turmas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {student.classes.length === 0 ? (
                <p className="text-sm text-zinc-500">Não matriculado em turmas.</p>
              ) : (
                student.classes.map((c) => (
                  <Link key={c.id} href={`/presenca?turma=${c.id}`}>
                    <Badge className="py-1">{c.name}</Badge>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="pb-3">
            <CardHeader
              title="Pagamentos"
              action={
                <Button variant="ghost" size="sm" onClick={() => setPaymentModal({})}>
                  <Plus className="size-4" /> Novo
                </Button>
              }
            />
            {student.recentPayments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100">
                {student.recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                    <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setPaymentModal({ payment: p })}>
                      <p className="text-sm font-medium text-zinc-900">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-zinc-500">
                        Vence {formatDate(p.dueDate)}
                        {p.paidAt && ` · pago ${formatDate(p.paidAt)}`}
                      </p>
                    </button>
                    {p.status !== "Paid" && (
                      <Button size="sm" variant="secondary" onClick={() => markPaid(p)}>
                        Pagar
                      </Button>
                    )}
                    <Badge tone={paymentTone[p.status]}>{paymentStatusLabel[p.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {student.notes && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-zinc-900">Observações</p>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-600">{student.notes}</p>
            </Card>
          )}

          <div className="flex justify-end">
            {student.active ? (
              <Button variant="danger" size="sm" onClick={() => confirm(`Desativar ${student.name}?`) && setActive(false)}>
                <UserX className="size-4" /> Desativar aluno
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setActive(true)}>
                <UserCheck className="size-4" /> Reativar aluno
              </Button>
            )}
          </div>
        </div>
      </div>

      {graduating && (
        <GraduationModal
          student={student}
          onClose={() => setGraduating(false)}
          onSaved={() => {
            setGraduating(false);
            reload();
          }}
        />
      )}
      {paymentModal && (
        <PaymentModal
          payment={paymentModal.payment}
          student={paymentModal.payment ? undefined : student}
          onClose={() => setPaymentModal(null)}
          onSaved={() => {
            setPaymentModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
