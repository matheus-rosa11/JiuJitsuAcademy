using JiuJitsu.Api.Models;

namespace JiuJitsu.Api.DTOs;

// Belts

public record BeltDto(Guid Id, string Name, BeltCategory Category, int Order, int MaxDegree);

// Students

public record StudentListItemDto(
    Guid Id,
    string Name,
    StudentType StudentType,
    bool Active,
    int Age,
    Guid CurrentBeltId,
    string BeltName,
    int CurrentDegree,
    decimal MonthlyFee,
    string? Phone,
    string? Email);

public record StudentDetailDto(
    Guid Id,
    string Name,
    DateOnly BirthDate,
    int Age,
    string? Phone,
    string? Email,
    DateOnly JoinedAt,
    bool Active,
    StudentType StudentType,
    Guid CurrentBeltId,
    string BeltName,
    int CurrentDegree,
    decimal MonthlyFee,
    string? Notes,
    string PaymentStatus,
    AttendanceSummaryDto Attendance,
    IReadOnlyList<StudentResponsibleDto> Responsibles,
    IReadOnlyList<GraduationDto> Graduations,
    IReadOnlyList<ClassSummaryDto> Classes,
    IReadOnlyList<PaymentDto> RecentPayments);

public record AttendanceSummaryDto(int TotalPresences, int PresencesLast30Days, int SessionsLast30Days, double RateLast30Days);

public record StudentResponsibleDto(
    Guid ResponsibleId,
    string Name,
    string? Phone,
    string? Email,
    string Relationship,
    bool IsPrimary);

/// <summary>Links an existing responsible (ResponsibleId) or creates a new one (Name, Phone, Email).</summary>
public record ResponsibleLinkDto(
    Guid? ResponsibleId,
    string? Name,
    string? Phone,
    string? Email,
    string? Relationship,
    bool IsPrimary);

public record StudentRequest(
    string Name,
    DateOnly BirthDate,
    string? Phone,
    string? Email,
    DateOnly JoinedAt,
    bool Active,
    StudentType StudentType,
    Guid CurrentBeltId,
    int CurrentDegree,
    decimal MonthlyFee,
    string? Notes,
    List<Guid>? ClassIds,
    List<ResponsibleLinkDto>? Responsibles);

// Graduations

/// <summary>ChangeType: Initial | Belt | Degree.</summary>
public record GraduationDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    Guid BeltId,
    string BeltName,
    BeltCategory BeltCategory,
    int Degree,
    DateOnly Date,
    string? Notes,
    string ChangeType);

public record GraduationRequest(Guid BeltId, int Degree, DateOnly Date, string? Notes);

// Responsibles

public record ResponsibleDto(
    Guid Id,
    string Name,
    string? Phone,
    string? Email,
    string? Notes,
    IReadOnlyList<ResponsibleStudentDto> Students);

public record ResponsibleStudentDto(Guid Id, string Name, string Relationship);

public record ResponsibleRequest(string Name, string? Phone, string? Email, string? Notes);

// Classes

public record ClassSummaryDto(Guid Id, string Name);

public record ClassDto(
    Guid Id,
    string Name,
    string? Description,
    int[] DaysOfWeek,
    string StartTime,
    string EndTime,
    bool Active,
    StudentType? TargetStudentType,
    int EnrolledCount);

public record ClassRequest(
    string Name,
    string? Description,
    int[] DaysOfWeek,
    string StartTime,
    string EndTime,
    bool Active,
    StudentType? TargetStudentType);

// Attendance

public record AttendanceStudentDto(
    Guid StudentId,
    string Name,
    StudentType StudentType,
    string BeltName,
    int Degree,
    bool Present);

public record AttendanceSheetDto(
    Guid ClassId,
    string ClassName,
    DateOnly Date,
    bool Saved,
    IReadOnlyList<AttendanceStudentDto> Students);

public record SaveAttendanceItem(Guid StudentId, bool Present);
public record SaveAttendanceRequest(Guid ClassId, DateOnly Date, List<SaveAttendanceItem> Items);

public record StudentFrequencyDto(
    Guid StudentId,
    string Name,
    StudentType StudentType,
    string BeltName,
    int Degree,
    int Presences,
    int Sessions,
    double Rate,
    DateOnly? LastPresence);

// Payments

public record PaymentDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    decimal Amount,
    DateOnly DueDate,
    DateOnly? PaidAt,
    PaymentStatus Status,
    string? Notes);

public record PaymentRequest(
    Guid StudentId,
    decimal Amount,
    DateOnly DueDate,
    DateOnly? PaidAt,
    PaymentStatus Status,
    string? Notes);

public record MarkPaidRequest(DateOnly? PaidAt);

public record GeneratePaymentsRequest(int Year, int Month, int DueDay = 10);

public record GeneratePaymentsResult(int Created);

public record FinanceSummaryDto(
    int Year,
    int Month,
    decimal ExpectedRevenue,
    decimal Received,
    decimal Pending,
    decimal Overdue,
    int OverdueCount);

// Dashboard

public record DashboardDto(
    StudentCountsDto Students,
    FinanceSummaryDto Finance,
    AttendanceOverviewDto Attendance,
    IReadOnlyList<BeltDistributionDto> AdultBelts,
    IReadOnlyList<BeltDistributionDto> ChildBelts,
    IReadOnlyList<GraduationDto> RecentGraduations);

public record StudentCountsDto(int Active, int Adults, int Children, int Inactive);

public record AttendanceOverviewDto(
    double AverageRate,
    int PresencesLast30Days,
    IReadOnlyList<StudentFrequencyDto> LowAttendance);

public record BeltDistributionDto(Guid BeltId, string BeltName, int Count);
