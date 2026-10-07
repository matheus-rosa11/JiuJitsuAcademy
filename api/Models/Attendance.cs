namespace JiuJitsu.Api.Models;

public class Attendance
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public Guid ClassId { get; set; }
    public DateOnly Date { get; set; }
    public bool Present { get; set; }

    public Student Student { get; set; } = null!;
    public TrainingClass Class { get; set; } = null!;
}
