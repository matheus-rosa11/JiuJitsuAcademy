export type StudentType = "Adult" | "Child";
export type BeltCategory = "Adult" | "Child";
export type PaymentStatus = "Pending" | "Paid" | "Overdue";
export type ChangeType = "Initial" | "Belt" | "Degree";

export interface Belt {
  id: string;
  name: string;
  category: BeltCategory;
  order: number;
  maxDegree: number;
}

export interface StudentListItem {
  id: string;
  name: string;
  studentType: StudentType;
  active: boolean;
  age: number;
  currentBeltId: string;
  beltName: string;
  currentDegree: number;
  monthlyFee: number;
  phone: string | null;
  email: string | null;
}

export interface StudentResponsible {
  responsibleId: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string;
  isPrimary: boolean;
}

export interface Graduation {
  id: string;
  studentId: string;
  studentName: string;
  beltId: string;
  beltName: string;
  beltCategory: BeltCategory;
  degree: number;
  date: string;
  notes: string | null;
  changeType: ChangeType;
}

export interface ClassSummary {
  id: string;
  name: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: PaymentStatus;
  notes: string | null;
}

export interface StudentDetail {
  id: string;
  name: string;
  birthDate: string;
  age: number;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  active: boolean;
  studentType: StudentType;
  currentBeltId: string;
  beltName: string;
  currentDegree: number;
  monthlyFee: number;
  notes: string | null;
  paymentStatus: "UpToDate" | "Overdue";
  attendance: {
    totalPresences: number;
    presencesLast30Days: number;
    sessionsLast30Days: number;
    rateLast30Days: number;
  };
  responsibles: StudentResponsible[];
  graduations: Graduation[];
  classes: ClassSummary[];
  recentPayments: Payment[];
}

export interface ResponsibleLink {
  responsibleId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship: string;
  isPrimary: boolean;
}

export interface StudentRequest {
  name: string;
  birthDate: string;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  active: boolean;
  studentType: StudentType;
  currentBeltId: string;
  currentDegree: number;
  monthlyFee: number;
  notes: string | null;
  classIds: string[];
  responsibles: ResponsibleLink[];
}

export interface Responsible {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  students: { id: string; name: string; relationship: string }[];
}

export interface TrainingClass {
  id: string;
  name: string;
  description: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  active: boolean;
  targetStudentType: StudentType | null;
  enrolledCount: number;
}

export type ClassRequest = Omit<TrainingClass, "id" | "enrolledCount">;

export interface AttendanceSheet {
  classId: string;
  className: string;
  date: string;
  saved: boolean;
  students: {
    studentId: string;
    name: string;
    studentType: StudentType;
    beltName: string;
    degree: number;
    present: boolean;
  }[];
}

export interface StudentFrequency {
  studentId: string;
  name: string;
  studentType: StudentType;
  beltName: string;
  degree: number;
  presences: number;
  sessions: number;
  rate: number;
  lastPresence: string | null;
}

export interface FinanceSummary {
  year: number;
  month: number;
  expectedRevenue: number;
  received: number;
  pending: number;
  overdue: number;
  overdueCount: number;
}

export interface Dashboard {
  students: { active: number; adults: number; children: number; inactive: number };
  finance: FinanceSummary;
  attendance: {
    averageRate: number;
    presencesLast30Days: number;
    lowAttendance: StudentFrequency[];
  };
  adultBelts: { beltId: string; beltName: string; count: number }[];
  childBelts: { beltId: string; beltName: string; count: number }[];
  recentGraduations: Graduation[];
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Calls the backend through the Next.js /api proxy. Throws ApiError with a user-facing message. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Algo deu errado. Tente novamente.";
    try {
      const data = await response.json();
      const validation = data.errors ? (Object.values(data.errors).flat()[0] as string) : undefined;
      message = data.message ?? validation ?? data.title ?? message;
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
