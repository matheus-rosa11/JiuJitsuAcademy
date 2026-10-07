using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class ClassService(AppDbContext db)
{
    public async Task<List<ClassDto>> ListAsync()
    {
        var classes = await db.Classes.AsNoTracking()
            .Select(c => new { Class = c, Enrolled = c.Students.Count(s => s.Student.Active) })
            .ToListAsync();

        return classes
            .OrderByDescending(c => c.Class.Active).ThenBy(c => c.Class.StartTime).ThenBy(c => c.Class.Name)
            .Select(c => ToDto(c.Class, c.Enrolled))
            .ToList();
    }

    public async Task<ClassDto> CreateAsync(ClassRequest request)
    {
        var entity = new TrainingClass { Id = Guid.NewGuid() };
        Apply(entity, request);
        db.Classes.Add(entity);
        await db.SaveChangesAsync();
        return ToDto(entity, 0);
    }

    public async Task<ClassDto> UpdateAsync(Guid id, ClassRequest request)
    {
        var entity = await db.Classes.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new NotFoundException("Turma não encontrada.");

        Apply(entity, request);
        await db.SaveChangesAsync();

        var enrolled = await db.StudentClasses.CountAsync(sc => sc.ClassId == id && sc.Student.Active);
        return ToDto(entity, enrolled);
    }

    private static void Apply(TrainingClass entity, ClassRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Nome da turma é obrigatório.");
        if (request.DaysOfWeek is null || request.DaysOfWeek.Length == 0)
            throw new DomainException("Informe pelo menos um dia da semana.");
        if (request.DaysOfWeek.Any(d => d is < 0 or > 6))
            throw new DomainException("Dia da semana inválido.");
        if (!TimeOnly.TryParse(request.StartTime, out var start) || !TimeOnly.TryParse(request.EndTime, out var end))
            throw new DomainException("Horário inválido.");
        if (end <= start)
            throw new DomainException("O horário de término deve ser depois do início.");

        entity.Name = request.Name.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.DaysOfWeek = request.DaysOfWeek.Distinct().Order().ToArray();
        entity.StartTime = start;
        entity.EndTime = end;
        entity.Active = request.Active;
        entity.TargetStudentType = request.TargetStudentType;
    }

    private static ClassDto ToDto(TrainingClass c, int enrolled) =>
        new(c.Id, c.Name, c.Description, c.DaysOfWeek, c.StartTime.ToString("HH:mm"), c.EndTime.ToString("HH:mm"),
            c.Active, c.TargetStudentType, enrolled);
}
