using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Services;

public class ResponsibleService(AppDbContext db)
{
    public async Task<List<ResponsibleDto>> ListAsync(string? search)
    {
        var query = db.Responsibles.AsNoTracking()
            .Include(r => r.Students).ThenInclude(s => s.Student)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(r => EF.Functions.ILike(r.Name, $"%{search.Trim()}%"));

        var items = await query.OrderBy(r => r.Name).ToListAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<ResponsibleDto> CreateAsync(ResponsibleRequest request)
    {
        var entity = new Responsible { Id = Guid.NewGuid() };
        Apply(entity, request);
        db.Responsibles.Add(entity);
        await db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<ResponsibleDto> UpdateAsync(Guid id, ResponsibleRequest request)
    {
        var entity = await db.Responsibles
            .Include(r => r.Students).ThenInclude(s => s.Student)
            .FirstOrDefaultAsync(r => r.Id == id)
            ?? throw new NotFoundException("Responsável não encontrado.");

        Apply(entity, request);
        await db.SaveChangesAsync();
        return ToDto(entity);
    }

    private static void Apply(Responsible entity, ResponsibleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Nome do responsável é obrigatório.");

        entity.Name = request.Name.Trim();
        entity.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        entity.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
    }

    private static ResponsibleDto ToDto(Responsible r) =>
        new(r.Id, r.Name, r.Phone, r.Email, r.Notes,
            r.Students.OrderBy(s => s.Student.Name)
                .Select(s => new ResponsibleStudentDto(s.StudentId, s.Student.Name, s.Relationship))
                .ToList());
}
