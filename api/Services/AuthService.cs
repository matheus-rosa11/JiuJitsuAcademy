using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using JiuJitsu.Api.Data;
using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace JiuJitsu.Api.Services;

public record Actor(Guid UserId, string Email, UserRole Role, Guid? StudentId)
{
    public bool IsAdmin => Role == UserRole.Admin;

    public static Actor From(ClaimsPrincipal principal)
    {
        var id = principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new ForbiddenException("Entre na sua conta para continuar.");
        var roleText = principal.FindFirstValue("role") ?? principal.FindFirstValue(ClaimTypes.Role);
        if (!Enum.TryParse<UserRole>(roleText, out var role))
            throw new ForbiddenException("Entre na sua conta para continuar.");
        var studentText = principal.FindFirstValue("student_id");
        return new Actor(
            Guid.Parse(id),
            principal.FindFirstValue(JwtRegisteredClaimNames.Email) ?? principal.FindFirstValue(ClaimTypes.Email) ?? "",
            role,
            Guid.TryParse(studentText, out var studentId) ? studentId : null);
    }
}

public class AuthService(AppDbContext db, StudentService students, IConfiguration configuration)
{
    public const string Issuer = "studiomega";
    public const string Audience = "studiomega";
    private static readonly PasswordHasher<UserAccount> Hasher = new();
    private static readonly TimeSpan SessionLength = TimeSpan.FromDays(60);

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = Normalize(request.Email) ?? throw new DomainException("E-mail é obrigatório.");
        ValidatePassword(request.Password);
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Nome é obrigatório.");
        await EnsureEmailAvailableAsync(email, null);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await using var tx = await db.Database.BeginTransactionAsync();
        var student = await students.CreateAsync(new StudentRequest(
            request.Name.Trim(),
            request.BirthDate,
            request.Phone,
            email,
            today,
            true,
            StudentType.Adult,
            request.CurrentBeltId,
            request.CurrentDegree,
            0,
            Clean(request.Notes),
            request.ClassIds,
            [],
            false,
            false));

        var user = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = email,
            Role = UserRole.Student,
            StudentId = student.Id,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = Hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Session(user, student.Name);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var email = Normalize(request.Email);
        var user = await db.Users.Include(u => u.Student).FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || Hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password ?? "") == PasswordVerificationResult.Failed)
            throw new UnauthorizedException("E-mail ou senha não confere.");
        if (user.Role == UserRole.Student && user.Student is { Active: false })
            throw new UnauthorizedException("Esta conta está inativa. Fale com a recepção.");
        return Session(user, user.Student?.Name);
    }

    public async Task<AuthResponse> MeAsync(Actor actor)
    {
        var user = await db.Users.Include(u => u.Student).FirstOrDefaultAsync(u => u.Id == actor.UserId)
            ?? throw new UnauthorizedException("Entre na sua conta para continuar.");
        return Session(user, user.Student?.Name) with { Token = "" };
    }

    public async Task EnsureEmailAvailableAsync(string? email, Guid? exceptStudentId)
    {
        var normalized = Normalize(email);
        if (normalized is null)
            return;
        var taken = await db.Users.AnyAsync(u => u.Email == normalized && u.StudentId != exceptStudentId);
        if (taken)
            throw new DomainException("Este e-mail já tem conta.");
    }

    public async Task SyncLoginEmailAsync(Guid studentId, string? email)
    {
        var normalized = Normalize(email);
        if (normalized is null)
            return;
        var user = await db.Users.FirstOrDefaultAsync(u => u.StudentId == studentId);
        if (user is null || user.Email == normalized)
            return;
        user.Email = normalized;
        await db.SaveChangesAsync();
    }

    public void RejectOtherStudent(Actor actor, Guid studentId)
    {
        if (!actor.IsAdmin && actor.StudentId != studentId)
            throw new NotFoundException("Aluno não encontrado.");
    }

    public static async Task EnsureAdminsAsync(AppDbContext db, IConfiguration configuration)
    {
        await EnsureAdminAsync(db, configuration, "AUTH_ADMIN_EMAIL", "Auth:AdminEmail", "AUTH_ADMIN_PASSWORD", "Auth:AdminPassword");
        await EnsureAdminAsync(db, configuration, "AUTH_DEV_EMAIL", "Auth:DevEmail", "AUTH_DEV_PASSWORD", "Auth:DevPassword");
    }

    private AuthResponse Session(UserAccount user, string? name)
    {
        var display = !string.IsNullOrWhiteSpace(name)
            ? name
            : user.Role == UserRole.Admin ? "Administrador" : user.Email;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("role", user.Role.ToString()),
        };
        if (user.StudentId.HasValue)
            claims.Add(new Claim("student_id", user.StudentId.Value.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey(configuration)));
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(SessionLength),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(token), user.Id, user.Email, user.Role.ToString(), user.StudentId, display);
    }

    public static string SigningKey(IConfiguration configuration)
    {
        var key = First(configuration, "AUTH_SIGNING_KEY", "Auth:SigningKey");
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("Defina AUTH_SIGNING_KEY com pelo menos 32 caracteres.");
        return key;
    }

    private static async Task EnsureAdminAsync(AppDbContext db, IConfiguration configuration, string emailEnv, string emailKey, string passwordEnv, string passwordKey)
    {
        var email = Normalize(First(configuration, emailEnv, emailKey));
        var password = First(configuration, passwordEnv, passwordKey);
        if (email is null || string.IsNullOrWhiteSpace(password))
            return;
        if (await db.Users.AnyAsync(u => u.Email == email))
            return;
        var user = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = email,
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = Hasher.HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    private static void ValidatePassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            throw new DomainException("A senha precisa ter pelo menos 8 caracteres.");
    }

    private static string? Normalize(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return null;
        return email.Trim().ToLowerInvariant();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? First(IConfiguration configuration, string env, string key)
    {
        var fromEnv = Environment.GetEnvironmentVariable(env);
        if (!string.IsNullOrWhiteSpace(fromEnv))
            return fromEnv.Trim();
        var fromConfig = configuration[key];
        return string.IsNullOrWhiteSpace(fromConfig) ? null : fromConfig.Trim();
    }
}

public class UnauthorizedException(string message) : Exception(message);
