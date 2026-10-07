using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class GraduationService(AppDbContext db)
{
    /// <summary>
    /// Adds a graduation to the student's history and syncs CurrentBelt/CurrentDegree
    /// with the most recent graduation. History is append-only.
    /// </summary>
    public async Task<GraduationDto> CreateAsync(Guid studentId, GraduationRequest request)
    {
        var student = await db.Students
            .Include(s => s.Graduations)
            .FirstOrDefaultAsync(s => s.Id == studentId)
            ?? throw new NotFoundException("Aluno não encontrado.");

        var belt = await db.Belts.FindAsync(request.BeltId)
            ?? throw new DomainException("Faixa não encontrada.");

        BeltRules.EnsureValid(student.StudentType, belt, request.Degree);

        if (request.Date > DateOnly.FromDateTime(DateTime.UtcNow))
            throw new DomainException("A data da graduação não pode ser futura.");

        var graduation = new Graduation
        {
            Id = Guid.NewGuid(),
            StudentId = student.Id,
            BeltId = belt.Id,
            Degree = request.Degree,
            Date = request.Date,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        db.Graduations.Add(graduation);

        var latest = student.Graduations.Append(graduation).Distinct()
            .OrderBy(g => g.Date).ThenBy(g => g.CreatedAt).Last();
        student.CurrentBeltId = latest.BeltId;
        student.CurrentDegree = latest.Degree;
        student.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return (await ListByStudentAsync(studentId)).First(g => g.Id == graduation.Id);
    }

    public async Task<List<GraduationDto>> ListByStudentAsync(Guid studentId)
    {
        var grads = await db.Graduations
            .AsNoTracking()
            .Include(g => g.Belt)
            .Include(g => g.Student)
            .Where(g => g.StudentId == studentId)
            .ToListAsync();

        return BuildTimeline(grads);
    }

    public async Task<List<GraduationDto>> ListRecentAsync(int take)
    {
        var recentStudentIds = await db.Graduations
            .AsNoTracking()
            .OrderByDescending(g => g.Date).ThenByDescending(g => g.CreatedAt)
            .Take(take)
            .Select(g => g.StudentId)
            .Distinct()
            .ToListAsync();

        // Load full histories of those students so ChangeType compares against the previous record.
        var grads = await db.Graduations
            .AsNoTracking()
            .Include(g => g.Belt)
            .Include(g => g.Student)
            .Where(g => recentStudentIds.Contains(g.StudentId))
            .ToListAsync();

        return grads
            .GroupBy(g => g.StudentId)
            .SelectMany(BuildTimeline)
            .OrderByDescending(g => g.Date)
            .Take(take)
            .ToList();
    }

    /// <summary>Returns the history newest-first, flagging each entry as Initial, Belt or Degree change.</summary>
    public static List<GraduationDto> BuildTimeline(IEnumerable<Graduation> graduations)
    {
        var ordered = graduations.OrderBy(g => g.Date).ThenBy(g => g.CreatedAt).ToList();
        var result = new List<GraduationDto>(ordered.Count);

        for (var i = 0; i < ordered.Count; i++)
        {
            var g = ordered[i];
            var changeType = i == 0 ? "Initial" : ordered[i - 1].BeltId != g.BeltId ? "Belt" : "Degree";
            result.Add(new GraduationDto(
                g.Id, g.StudentId, g.Student.Name, g.BeltId, g.Belt.Name, g.Belt.Category,
                g.Degree, g.Date, g.Notes, changeType));
        }

        result.Reverse();
        return result;
    }
}
