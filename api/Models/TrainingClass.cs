namespace JiuJitsu.Api.Models;

/// <summary>A recurring class ("turma"). Named TrainingClass because "Class" is a C# keyword.</summary>
public class TrainingClass
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>System.DayOfWeek values (0 = Sunday ... 6 = Saturday).</summary>
    public int[] DaysOfWeek { get; set; } = [];
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool Active { get; set; } = true;
    /// <summary>When set, only students of this type can enroll.</summary>
    public StudentType? TargetStudentType { get; set; }

    public ICollection<Attendance> Attendances { get; set; } = [];
    public ICollection<StudentClass> Students { get; set; } = [];
}
