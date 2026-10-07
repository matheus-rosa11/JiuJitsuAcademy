using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class PaymentService(AppDbContext db)
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>Pending payments past their due date become Overdue. Cheap enough to run on read.</summary>
    public async Task RefreshOverdueAsync()
    {
        var today = Today;
        await db.Payments
            .Where(p => p.Status == PaymentStatus.Pending && p.DueDate < today)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, PaymentStatus.Overdue));
    }

    public async Task<List<PaymentDto>> ListAsync(PaymentStatus? status, string? search, int? year, int? month)
    {
        await RefreshOverdueAsync();

        var query = db.Payments.AsNoTracking().AsQueryable();

        if (status.HasValue)
            query = query.Where(p => p.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => EF.Functions.ILike(p.Student.Name, $"%{search.Trim()}%"));
        if (year.HasValue && month.HasValue)
        {
            var start = new DateOnly(year.Value, month.Value, 1);
            var end = start.AddMonths(1);
            query = query.Where(p => p.DueDate >= start && p.DueDate < end);
        }

        return await query
            .OrderByDescending(p => p.DueDate).ThenBy(p => p.Student.Name)
            .Select(p => new PaymentDto(p.Id, p.StudentId, p.Student.Name, p.Amount, p.DueDate, p.PaidAt, p.Status, p.Notes))
            .ToListAsync();
    }

    public async Task<FinanceSummaryDto> GetSummaryAsync(int year, int month)
    {
        await RefreshOverdueAsync();

        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);

        var expected = await db.Students.Where(s => s.Active).SumAsync(s => s.MonthlyFee);

        var monthPayments = await db.Payments.AsNoTracking()
            .Where(p => p.DueDate >= start && p.DueDate < end)
            .Select(p => new { p.Amount, p.Status })
            .ToListAsync();

        // Overdue is cumulative: everything still unpaid from any past month.
        var overdue = await db.Payments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Overdue)
            .Select(p => p.Amount)
            .ToListAsync();

        return new FinanceSummaryDto(
            year,
            month,
            expected,
            monthPayments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.Amount),
            monthPayments.Where(p => p.Status == PaymentStatus.Pending).Sum(p => p.Amount),
            overdue.Sum(),
            overdue.Count);
    }

    public async Task<PaymentDto> CreateAsync(PaymentRequest request)
    {
        var student = await db.Students.FindAsync(request.StudentId)
            ?? throw new DomainException("Pagamento precisa pertencer a um aluno válido.");

        var payment = new Payment { Id = Guid.NewGuid(), StudentId = student.Id };
        Apply(payment, request);

        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return ToDto(payment, student.Name);
    }

    public async Task<PaymentDto> UpdateAsync(Guid id, PaymentRequest request)
    {
        var payment = await db.Payments.Include(p => p.Student).FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundException("Pagamento não encontrado.");

        Apply(payment, request);
        await db.SaveChangesAsync();
        return ToDto(payment, payment.Student.Name);
    }

    public async Task<PaymentDto> MarkPaidAsync(Guid id, DateOnly? paidAt)
    {
        var payment = await db.Payments.Include(p => p.Student).FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundException("Pagamento não encontrado.");

        payment.Status = PaymentStatus.Paid;
        payment.PaidAt = paidAt ?? Today;
        await db.SaveChangesAsync();
        return ToDto(payment, payment.Student.Name);
    }

    public async Task DeleteAsync(Guid id)
    {
        var payment = await db.Payments.FindAsync(id) ?? throw new NotFoundException("Pagamento não encontrado.");
        db.Payments.Remove(payment);
        await db.SaveChangesAsync();
    }

    /// <summary>Creates one pending payment per active student that has no payment in the given month yet.</summary>
    public async Task<GeneratePaymentsResult> GenerateMonthlyAsync(GeneratePaymentsRequest request)
    {
        if (request.Month is < 1 or > 12)
            throw new DomainException("Mês inválido.");

        var start = new DateOnly(request.Year, request.Month, 1);
        var end = start.AddMonths(1);
        var dueDate = new DateOnly(request.Year, request.Month, Math.Clamp(request.DueDay, 1, DateTime.DaysInMonth(request.Year, request.Month)));

        var students = await db.Students
            .Where(s => s.Active && s.MonthlyFee > 0 && !s.Payments.Any(p => p.DueDate >= start && p.DueDate < end))
            .ToListAsync();

        foreach (var student in students)
        {
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                StudentId = student.Id,
                Amount = student.MonthlyFee,
                DueDate = dueDate,
                Status = dueDate < Today ? PaymentStatus.Overdue : PaymentStatus.Pending
            });
        }

        await db.SaveChangesAsync();
        return new GeneratePaymentsResult(students.Count);
    }

    private static void Apply(Payment payment, PaymentRequest request)
    {
        if (request.Amount <= 0)
            throw new DomainException("Valor deve ser maior que zero.");

        payment.Amount = request.Amount;
        payment.DueDate = request.DueDate;
        payment.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        if (request.Status == PaymentStatus.Paid)
        {
            payment.Status = PaymentStatus.Paid;
            payment.PaidAt = request.PaidAt ?? Today;
        }
        else
        {
            payment.PaidAt = null;
            payment.Status = request.DueDate < Today ? PaymentStatus.Overdue : PaymentStatus.Pending;
        }
    }

    private static PaymentDto ToDto(Payment p, string studentName) =>
        new(p.Id, p.StudentId, studentName, p.Amount, p.DueDate, p.PaidAt, p.Status, p.Notes);
}
