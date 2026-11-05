namespace JiuJitsu.Api.Models;

public enum UserRole
{
    Admin = 1,
    Student = 2
}

public class UserAccount
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public Guid? StudentId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Student? Student { get; set; }
}
