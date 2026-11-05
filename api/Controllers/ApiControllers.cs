using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using JiuJitsu.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Controllers;

// Errors are mapped centrally in Program.cs: DomainException -> 400, NotFoundException -> 404.

[ApiController]
[Route("api/belts")]
public class BeltsController(AppDbContext db) : ControllerBase
{
    /// <summary>Use ?studentType=Adult|Child so forms only ever list compatible belts.</summary>
    [AllowAnonymous]
    [HttpGet]
    public async Task<List<BeltDto>> List([FromQuery] StudentType? studentType)
    {
        var query = db.Belts.AsNoTracking();
        if (studentType.HasValue)
        {
            var category = BeltRules.CategoryFor(studentType.Value);
            query = query.Where(b => b.Category == category);
        }

        var belts = await query.OrderBy(b => b.Category).ThenBy(b => b.Order).ToListAsync();
        return belts.Select(b => new BeltDto(b.Id, b.Name, b.Category, b.Order, BeltRules.MaxDegree(b))).ToList();
    }
}

[ApiController]
[Route("api/students")]
public class StudentsController(StudentService students, GraduationService graduations, AuthService auth) : ControllerBase
{
    [Authorize(Roles = "Admin")]
    [HttpGet]
    public Task<List<StudentListItemDto>> List(
        [FromQuery] string? search,
        [FromQuery] StudentType? type,
        [FromQuery] bool? active,
        [FromQuery] Guid? beltId)
        => students.ListAsync(search, type, active, beltId);

    [Authorize(Roles = "Admin")]
    [HttpGet("professors")]
    public Task<List<ProfessorDto>> Professors() => students.ListProfessorsAsync();

    [HttpGet("{id:guid}")]
    public Task<StudentDetailDto> Get(Guid id)
    {
        auth.RejectOtherStudent(Actor.From(User), id);
        return students.GetAsync(id);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<StudentDetailDto>> Create(StudentRequest request)
    {
        var created = await students.CreateAsync(request);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<StudentDetailDto> Update(Guid id, StudentRequest request)
    {
        var actor = Actor.From(User);
        auth.RejectOtherStudent(actor, id);
        if (!actor.IsAdmin)
        {
            var current = await students.GetAsync(id);
            request = request with
            {
                MonthlyFee = current.MonthlyFee,
                IsProfessor = current.IsProfessor,
                IsPrincipalProfessor = current.IsPrincipalProfessor,
                Active = current.Active,
                StudentType = current.StudentType
            };
        }

        await auth.EnsureEmailAvailableAsync(request.Email, id);
        var updated = await students.UpdateAsync(id, request);
        await auth.SyncLoginEmailAsync(id, updated.Email);
        return updated;
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        await students.DeactivateAsync(id);
        return NoContent();
    }

    [HttpGet("{id:guid}/graduations")]
    public Task<List<GraduationDto>> Graduations(Guid id)
    {
        auth.RejectOtherStudent(Actor.From(User), id);
        return graduations.ListByStudentAsync(id);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("{id:guid}/graduations")]
    public Task<GraduationDto> AddGraduation(Guid id, GraduationRequest request) => graduations.CreateAsync(id, request);
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/graduations")]
public class GraduationsController(GraduationService graduations) : ControllerBase
{
    [HttpGet("recent")]
    public Task<List<GraduationDto>> Recent([FromQuery] int take = 30) => graduations.ListRecentAsync(Math.Clamp(take, 1, 200));
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/responsibles")]
public class ResponsiblesController(ResponsibleService responsibles) : ControllerBase
{
    [HttpGet]
    public Task<List<ResponsibleDto>> List([FromQuery] string? search) => responsibles.ListAsync(search);

    [HttpPost]
    public Task<ResponsibleDto> Create(ResponsibleRequest request) => responsibles.CreateAsync(request);

    [HttpPut("{id:guid}")]
    public Task<ResponsibleDto> Update(Guid id, ResponsibleRequest request) => responsibles.UpdateAsync(id, request);
}

[ApiController]
[Route("api/classes")]
public class ClassesController(ClassService classes) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public Task<List<ClassDto>> List() => classes.ListAsync();

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public Task<ClassDto> Create(ClassRequest request) => classes.CreateAsync(request);

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public Task<ClassDto> Update(Guid id, ClassRequest request) => classes.UpdateAsync(id, request);
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/attendance")]
public class AttendanceController(AttendanceService attendance) : ControllerBase
{
    [HttpGet("sheet")]
    public Task<AttendanceSheetDto> Sheet([FromQuery] Guid classId, [FromQuery] DateOnly date, [FromQuery] bool includeInactive = false)
        => attendance.GetSheetAsync(classId, date, includeInactive);

    [HttpPost]
    public Task<AttendanceSheetDto> Save(SaveAttendanceRequest request) => attendance.SaveAsync(request);

    [HttpGet("frequency")]
    public Task<List<StudentFrequencyDto>> Frequency([FromQuery] int days = 30, [FromQuery] Guid? classId = null)
        => attendance.GetFrequencyAsync(Math.Clamp(days, 1, 365), classId);
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/payments")]
public class PaymentsController(PaymentService payments) : ControllerBase
{
    [HttpGet]
    public Task<List<PaymentDto>> List(
        [FromQuery] PaymentStatus? status,
        [FromQuery] string? search,
        [FromQuery] int? year,
        [FromQuery] int? month)
        => payments.ListAsync(status, search, year, month);

    [HttpGet("summary")]
    public Task<FinanceSummaryDto> Summary([FromQuery] int year, [FromQuery] int month) => payments.GetSummaryAsync(year, month);

    [HttpPost]
    public Task<PaymentDto> Create(PaymentRequest request) => payments.CreateAsync(request);

    [HttpPut("{id:guid}")]
    public Task<PaymentDto> Update(Guid id, PaymentRequest request) => payments.UpdateAsync(id, request);

    [HttpPost("{id:guid}/mark-paid")]
    public Task<PaymentDto> MarkPaid(Guid id, MarkPaidRequest? request) => payments.MarkPaidAsync(id, request?.PaidAt);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await payments.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("generate")]
    public Task<GeneratePaymentsResult> Generate(GeneratePaymentsRequest request) => payments.GenerateMonthlyAsync(request);
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/dashboard")]
public class DashboardController(DashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Get() => dashboard.GetAsync();
}
