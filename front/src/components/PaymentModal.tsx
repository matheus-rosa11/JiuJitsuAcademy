"use client";

import { useState } from "react";
import { api, type Payment, type PaymentStatus, type StudentListItem } from "@/lib/api";
import { formatCurrency, todayIso } from "@/lib/format";
import { StudentPicker } from "./StudentPicker";
import { useToast } from "./Toast";
import { Button, Field, Input, Modal, Segmented, Textarea } from "./ui";

/** Create (optionally for a fixed student) or edit a payment. */
export function PaymentModal({
  payment,
  student,
  onClose,
  onSaved,
}: {
  payment?: Payment;
  student?: { id: string; name: string; monthlyFee: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<{ id: string; name: string; monthlyFee: number } | undefined>(
    student ?? (payment ? { id: payment.studentId, name: payment.studentName, monthlyFee: payment.amount } : undefined),
  );
  const [amount, setAmount] = useState(String(payment?.amount ?? student?.monthlyFee ?? ""));
  const [dueDate, setDueDate] = useState(payment?.dueDate ?? todayIso());
  const [status, setStatus] = useState<"Paid" | "Open">(payment?.status === "Paid" ? "Paid" : "Open");
  const [paidAt, setPaidAt] = useState(payment?.paidAt ?? todayIso());
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function pick(s: StudentListItem) {
    setPicked({ id: s.id, name: s.name, monthlyFee: s.monthlyFee });
    setAmount(String(s.monthlyFee));
  }

  async function save() {
    if (!picked) return;
    setSaving(true);
    try {
      const body = {
        studentId: picked.id,
        amount: Number(amount.replace(",", ".")),
        dueDate,
        paidAt: status === "Paid" ? paidAt : null,
        status: (status === "Paid" ? "Paid" : "Pending") as PaymentStatus,
        notes: notes || null,
      };
      await api(payment ? `/payments/${payment.id}` : "/payments", { method: payment ? "PUT" : "POST", body });
      toast(payment ? "Pagamento atualizado." : "Pagamento registrado.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={payment ? "Editar pagamento" : "Novo pagamento"}
      footer={
        picked && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Salvar
            </Button>
          </>
        )
      }
    >
      {!picked ? (
        <StudentPicker onPick={pick} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">{picked.name}</p>
              <p className="text-xs text-zinc-500">Mensalidade: {formatCurrency(picked.monthlyFee)}</p>
            </div>
            {!student && !payment && (
              <Button variant="ghost" size="sm" onClick={() => setPicked(undefined)}>
                Trocar
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor (R$)">
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Vencimento">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Situação" group>
            <Segmented
              className="w-full"
              value={status}
              onChange={setStatus}
              options={[
                { value: "Open", label: "Em aberto" },
                { value: "Paid", label: "Pago" },
              ]}
            />
          </Field>
          {status === "Paid" && (
            <Field label="Pago em">
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
          )}
          <Field label="Observações">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: pago em dinheiro" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
