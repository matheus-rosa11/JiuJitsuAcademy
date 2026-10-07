using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class AttendanceService(AppDbContext db)
{
    public const double LowAttendanceThreshold = 60;

    /// <summary>
    /// Roll call for a class on a date: enrolled active students plus anyone already recorded that day.
    /// </summary>
    public async Task<AttendanceSheetDto> GetSheetAsync(Guid classId, DateOnly date, bool includeInactive)
    {
        var trainingClass = await db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == classId)
            ?? throw new NotFoundException("Turma não encontrada.");

        var existing = await db.Attendances.AsNoTracking()
            .Where(a => a.ClassId == classId && a.Date == date)
            .ToDictionaryAsync(a => a.StudentId, a => a.Present);
        var recordedIds = existing.Keys.ToList();

        var students = await db.Students.AsNoTracking()
            .Include(s => s.CurrentBelt)
            .Where(s => (s.Classes.Any(c => c.ClassId == classId) && (includeInactive || s.Active))
                        || recordedIds.Contains(s.Id))
            .OrderBy(s => s.Name)
            .ToListAsync();

        return new AttendanceSheetDto(
            classId,
            trainingClass.Name,
            date,
            existing.Count > 0,
            students.Select(s => new AttendanceStudentDto(
                s.Id, s.Name, s.StudentType, s.CurrentBelt.Name, s.CurrentDegree,
                existing.GetValueOrDefault(s.Id))).ToList());
    }

    /// <summary>Upserts one record per student/class/date (unique index prevents duplicates).</summary>
    public async Task<AttendanceSheetDto> SaveAsync(SaveAttendanceRequest request)
    {
        if (!await db.Classes.AnyAsync(c => c.Id == request.ClassId))
            throw new NotFoundException("Turma não encontrada.");
        if (request.Date > DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1))
            throw new DomainException("Não é possível registrar presença em data futura.");

        var items = request.Items.DistinctBy(i => i.StudentId).ToList();
        var studentIds = items.Select(i => i.StudentId).ToList();

        var knownStudents = await db.Students.CountAsync(s => studentIds.Contains(s.Id));
        if (knownStudents != studentIds.Count)
            throw new DomainException("Aluno não encontrado.");

        var existing = await db.Attendances
            .Where(a => a.ClassId == request.ClassId && a.Date == request.Date)
            .ToDictionaryAsync(a => a.StudentId);

        foreach (var item in items)
        {
            if (existing.TryGetValue(item.StudentId, out var attendance))
            {
                attendance.Present = item.Present;
                continue;
            }

            db.Attendances.Add(new Attendance
            {
                Id = Guid.NewGuid(),
                StudentId = item.StudentId,
                ClassId = request.ClassId,
                Date = request.Date,
                Present = item.Present
            });
        }

        await db.SaveChangesAsync();
        return await GetSheetAsync(request.ClassId, request.Date, includeInactive: false);
    }

    /// <summary>Frequency per active student over the last N days (presences / recorded sessions).</summary>
    public async Task<List<StudentFrequencyDto>> GetFrequencyAsync(int days, Guid? classId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = today.AddDays(-days);

        var students = await db.Students.AsNoTracking()
            .Include(s => s.CurrentBelt)
            .Where(s => s.Active && (classId == null || s.Classes.Any(c => c.ClassId == classId)))
            .ToListAsync();

        var records = await db.Attendances.AsNoTracking()
            .Where(a => a.Date > from && a.Date <= today && (classId == null || a.ClassId == classId))
            .Select(a => new { a.StudentId, a.Date, a.Present })
            .ToListAsync();

        var byStudent = records.ToLookup(r => r.StudentId);

        return students
            .Select(s =>
            {
                var rows = byStudent[s.Id].ToList();
                var presences = rows.Count(r => r.Present);
                return new StudentFrequencyDto(
                    s.Id, s.Name, s.StudentType, s.CurrentBelt.Name, s.CurrentDegree,
                    presences,
                    rows.Count,
                    rows.Count == 0 ? 0 : Math.Round(presences * 100.0 / rows.Count, 1),
                    rows.Where(r => r.Present).Select(r => (DateOnly?)r.Date).Max());
            })
            .OrderBy(f => f.Sessions == 0)
            .ThenBy(f => f.Rate)
            .ThenBy(f => f.Name)
            .ToList();
    }
}
