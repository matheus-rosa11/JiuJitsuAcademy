using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class StudentService(AppDbContext db, PaymentService payments)
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public async Task<List<StudentListItemDto>> ListAsync(string? search, StudentType? type, bool? active, Guid? beltId)
    {
        var query = db.Students.AsNoTracking().Include(s => s.CurrentBelt).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => EF.Functions.ILike(s.Name, $"%{search.Trim()}%"));
        if (type.HasValue)
            query = query.Where(s => s.StudentType == type);
        if (active.HasValue)
            query = query.Where(s => s.Active == active);
        if (beltId.HasValue)
            query = query.Where(s => s.CurrentBeltId == beltId);

        var students = await query.OrderBy(s => s.Name).ToListAsync();
        var today = Today;

        return students.Select(s => new StudentListItemDto(
            s.Id, s.Name, s.StudentType, s.Active, s.AgeOn(today), s.CurrentBeltId, s.CurrentBelt.Name,
            s.CurrentDegree, s.MonthlyFee, s.Phone, s.Email)).ToList();
    }

    public async Task<StudentDetailDto> GetAsync(Guid id)
    {
        await payments.RefreshOverdueAsync();

        var student = await db.Students
            .AsNoTracking()
            .AsSplitQuery()
            .Include(s => s.CurrentBelt)
            .Include(s => s.Responsibles).ThenInclude(r => r.Responsible)
            .Include(s => s.Graduations).ThenInclude(g => g.Belt)
            .Include(s => s.Classes).ThenInclude(c => c.Class)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundException("Aluno não encontrado.");

        var today = Today;
        var from = today.AddDays(-30);
        var attendances = await db.Attendances.AsNoTracking()
            .Where(a => a.StudentId == id)
            .Select(a => new { a.Date, a.Present })
            .ToListAsync();
        var recent = attendances.Where(a => a.Date > from && a.Date <= today).ToList();
        var recentPresences = recent.Count(a => a.Present);

        var attendance = new AttendanceSummaryDto(
            attendances.Count(a => a.Present),
            recentPresences,
            recent.Count,
            recent.Count == 0 ? 0 : Math.Round(recentPresences * 100.0 / recent.Count, 1));

        // Pending payments are not due yet, so the student is still up to date.
        var paymentStatus = student.Payments.Any(p => p.Status == PaymentStatus.Overdue) ? "Overdue" : "UpToDate";

        foreach (var g in student.Graduations)
            g.Student = student;

        return new StudentDetailDto(
            student.Id,
            student.Name,
            student.BirthDate,
            student.AgeOn(today),
            student.Phone,
            student.Email,
            student.JoinedAt,
            student.Active,
            student.StudentType,
            student.CurrentBeltId,
            student.CurrentBelt.Name,
            student.CurrentDegree,
            student.MonthlyFee,
            student.Notes,
            paymentStatus,
            attendance,
            student.Responsibles
                .OrderByDescending(r => r.IsPrimary).ThenBy(r => r.Responsible.Name)
                .Select(r => new StudentResponsibleDto(
                    r.ResponsibleId, r.Responsible.Name, r.Responsible.Phone, r.Responsible.Email,
                    r.Relationship, r.IsPrimary))
                .ToList(),
            GraduationService.BuildTimeline(student.Graduations),
            student.Classes.Select(c => new ClassSummaryDto(c.ClassId, c.Class.Name)).OrderBy(c => c.Name).ToList(),
            student.Payments
                .OrderByDescending(p => p.DueDate)
                .Take(6)
                .Select(p => new PaymentDto(p.Id, p.StudentId, student.Name, p.Amount, p.DueDate, p.PaidAt, p.Status, p.Notes))
                .ToList());
    }

    public async Task<StudentDetailDto> CreateAsync(StudentRequest request)
    {
        var belt = await ValidateAsync(request);
        var now = DateTime.UtcNow;

        var student = new Student { Id = Guid.NewGuid(), CreatedAt = now };
        Apply(student, request);
        db.Students.Add(student);

        // Every student starts with a history entry so the timeline is never empty.
        db.Graduations.Add(new Graduation
        {
            Id = Guid.NewGuid(),
            StudentId = student.Id,
            BeltId = belt.Id,
            Degree = request.CurrentDegree,
            Date = request.JoinedAt,
            Notes = "Faixa no cadastro",
            CreatedAt = now
        });

        await SyncClassesAsync(student, request.ClassIds);
        await SyncResponsiblesAsync(student, request.Responsibles);

        await db.SaveChangesAsync();
        return await GetAsync(student.Id);
    }

    public async Task<StudentDetailDto> UpdateAsync(Guid id, StudentRequest request)
    {
        var student = await db.Students
            .Include(s => s.Responsibles)
            .Include(s => s.Classes)
            .FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundException("Aluno não encontrado.");

        await ValidateAsync(request);

        // Belt/degree edits through the form are still recorded in the history.
        if (student.CurrentBeltId != request.CurrentBeltId || student.CurrentDegree != request.CurrentDegree)
        {
            db.Graduations.Add(new Graduation
            {
                Id = Guid.NewGuid(),
                StudentId = student.Id,
                BeltId = request.CurrentBeltId,
                Degree = request.CurrentDegree,
                Date = Today,
                Notes = "Alterado no cadastro do aluno",
                CreatedAt = DateTime.UtcNow
            });
        }

        Apply(student, request);

        await SyncClassesAsync(student, request.ClassIds);
        await SyncResponsiblesAsync(student, request.Responsibles);

        await db.SaveChangesAsync();
        return await GetAsync(id);
    }

    /// <summary>Students are deactivated, never deleted, to preserve history.</summary>
    public async Task DeactivateAsync(Guid id)
    {
        var student = await db.Students.FindAsync(id) ?? throw new NotFoundException("Aluno não encontrado.");
        student.Active = false;
        student.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    private async Task<Belt> ValidateAsync(StudentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Nome é obrigatório.");
        if (request.BirthDate > Today)
            throw new DomainException("Data de nascimento inválida.");
        if (request.MonthlyFee < 0)
            throw new DomainException("Mensalidade não pode ser negativa.");

        var belt = await db.Belts.FindAsync(request.CurrentBeltId)
            ?? throw new DomainException("Faixa não encontrada.");
        BeltRules.EnsureValid(request.StudentType, belt, request.CurrentDegree);
        return belt;
    }

    private static void Apply(Student student, StudentRequest request)
    {
        student.Name = request.Name.Trim();
        student.BirthDate = request.BirthDate;
        student.Phone = Clean(request.Phone);
        student.Email = Clean(request.Email);
        student.JoinedAt = request.JoinedAt;
        student.Active = request.Active;
        student.StudentType = request.StudentType;
        student.CurrentBeltId = request.CurrentBeltId;
        student.CurrentDegree = request.CurrentDegree;
        student.MonthlyFee = request.MonthlyFee;
        student.Notes = Clean(request.Notes);
        student.UpdatedAt = DateTime.UtcNow;
    }

    private async Task SyncClassesAsync(Student student, List<Guid>? classIds)
    {
        var ids = (classIds ?? []).Distinct().ToList();
        var classes = await db.Classes.Where(c => ids.Contains(c.Id)).ToListAsync();
        if (classes.Count != ids.Count)
            throw new DomainException("Turma não encontrada.");

        foreach (var trainingClass in classes)
        {
            if (trainingClass.TargetStudentType.HasValue && trainingClass.TargetStudentType != student.StudentType)
                throw new DomainException($"A turma {trainingClass.Name} não aceita este tipo de aluno.");
        }

        foreach (var removed in student.Classes.Where(c => !ids.Contains(c.ClassId)).ToList())
            student.Classes.Remove(removed);

        foreach (var id in ids.Where(id => student.Classes.All(c => c.ClassId != id)))
            student.Classes.Add(new StudentClass { StudentId = student.Id, ClassId = id });
    }

    private async Task SyncResponsiblesAsync(Student student, List<ResponsibleLinkDto>? links)
    {
        // Responsibles are only tracked for children.
        links = student.StudentType == StudentType.Adult ? [] : links ?? [];

        if (links.Count(l => l.IsPrimary) > 1)
            throw new DomainException("Apenas um responsável pode ser o principal.");

        var linkedIds = links.Where(l => l.ResponsibleId.HasValue).Select(l => l.ResponsibleId!.Value).ToList();
        if (linkedIds.Count != linkedIds.Distinct().Count())
            throw new DomainException("O mesmo responsável foi informado mais de uma vez.");

        foreach (var removed in student.Responsibles.Where(r => !linkedIds.Contains(r.ResponsibleId)).ToList())
            student.Responsibles.Remove(removed);

        var hasPrimary = links.Any(l => l.IsPrimary);

        for (var i = 0; i < links.Count; i++)
        {
            var link = links[i];
            var relationship = Clean(link.Relationship) ?? "Responsável";
            var isPrimary = hasPrimary ? link.IsPrimary : i == 0;

            var existingLink = student.Responsibles.FirstOrDefault(r => r.ResponsibleId == link.ResponsibleId);
            if (existingLink is not null)
            {
                existingLink.Relationship = relationship;
                existingLink.IsPrimary = isPrimary;
                continue;
            }

            Responsible responsible;
            if (link.ResponsibleId.HasValue)
            {
                responsible = await db.Responsibles.FindAsync(link.ResponsibleId.Value)
                    ?? throw new DomainException("Responsável não encontrado.");
            }
            else
            {
                if (string.IsNullOrWhiteSpace(link.Name))
                    throw new DomainException("Nome do responsável é obrigatório.");

                responsible = new Responsible
                {
                    Id = Guid.NewGuid(),
                    Name = link.Name.Trim(),
                    Phone = Clean(link.Phone),
                    Email = Clean(link.Email)
                };
                db.Responsibles.Add(responsible);
            }

            student.Responsibles.Add(new StudentResponsible
            {
                StudentId = student.Id,
                ResponsibleId = responsible.Id,
                Relationship = relationship,
                IsPrimary = isPrimary
            });
        }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
