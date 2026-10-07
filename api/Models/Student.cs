namespace JiuJitsu.Api.Models;

public class Student
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly BirthDate { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public DateOnly JoinedAt { get; set; }
    public bool Active { get; set; } = true;
    public StudentType StudentType { get; set; }
    public Guid CurrentBeltId { get; set; }
    public int CurrentDegree { get; set; }
    public decimal MonthlyFee { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Belt CurrentBelt { get; set; } = null!;
    public ICollection<Graduation> Graduations { get; set; } = [];
    public ICollection<StudentResponsible> Responsibles { get; set; } = [];
    public ICollection<Attendance> Attendances { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<StudentClass> Classes { get; set; } = [];

    public int AgeOn(DateOnly date)
    {
        var age = date.Year - BirthDate.Year;
        return BirthDate.AddYears(age) > date ? age - 1 : age;
    }
}
