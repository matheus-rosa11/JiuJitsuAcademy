import type { PaymentStatus, StudentType } from "./api";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const formatCurrency = (value: number) => currency.format(value);

/** API dates are "yyyy-MM-dd" (no time zone); never pass them through `new Date(string)`. */
function parts(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { y, m, d };
}

export function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  const { y, m, d } = parts(isoDate);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function formatDateShort(isoDate: string) {
  const { y, m, d } = parts(isoDate);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export const monthName = (month: number) => MONTHS_FULL[month - 1];

export function weekdayOf(isoDate: string) {
  const { y, m, d } = parts(isoDate);
  return new Date(y, m - 1, d).getDay();
}

export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const todayIso = () => toIsoDate(new Date());

export function addDays(isoDate: string, days: number) {
  const { y, m, d } = parts(isoDate);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export function ageFrom(isoDate: string) {
  if (!isoDate) return null;
  const { y, m, d } = parts(isoDate);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export const degreeLabel = (degree: number) => (degree === 0 ? "sem grau" : `${degree}º grau`);

export const studentTypeLabel = (type: StudentType) => (type === "Adult" ? "Adulto" : "Infantil");

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  Paid: "Pago",
  Pending: "Pendente",
  Overdue: "Em atraso",
};

export function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

export function formatDays(days: number[]) {
  return days.map((d) => WEEKDAYS[d]).join(" · ");
}
