using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class DashboardService(
    AppDbContext db,
    PaymentService payments,
    AttendanceService attendance,
    GraduationService graduations)
{
    public async Task<DashboardDto> GetAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var students = await db.Students.AsNoTracking()
            .Select(s => new { s.Active, s.StudentType, s.CurrentBeltId })
            .ToListAsync();
        var active = students.Where(s => s.Active).ToList();

        var counts = new StudentCountsDto(
            active.Count,
            active.Count(s => s.StudentType == StudentType.Adult),
            active.Count(s => s.StudentType == StudentType.Child),
            students.Count - active.Count);

        var finance = await payments.GetSummaryAsync(today.Year, today.Month);

        // Students with fewer than 3 recorded sessions don't count toward low attendance.
        var frequency = await attendance.GetFrequencyAsync(30, null);
        var withSessions = frequency.Where(f => f.Sessions > 0).ToList();
        var attendanceOverview = new AttendanceOverviewDto(
            withSessions.Count == 0 ? 0 : Math.Round(withSessions.Average(f => f.Rate), 1),
            frequency.Sum(f => f.Presences),
            frequency
                .Where(f => f.Sessions >= 3 && f.Rate < AttendanceService.LowAttendanceThreshold)
                .OrderBy(f => f.Rate)
                .Take(8)
                .ToList());

        var belts = await db.Belts.AsNoTracking().OrderBy(b => b.Order).ToListAsync();
        var countByBelt = active.GroupBy(s => s.CurrentBeltId).ToDictionary(g => g.Key, g => g.Count());

        List<BeltDistributionDto> Distribution(BeltCategory category) => belts
            .Where(b => b.Category == category)
            .Select(b => new BeltDistributionDto(b.Id, b.Name, countByBelt.GetValueOrDefault(b.Id)))
            .ToList();

        return new DashboardDto(
            counts,
            finance,
            attendanceOverview,
            Distribution(BeltCategory.Adult),
            Distribution(BeltCategory.Child),
            await graduations.ListRecentAsync(6));
    }
}
