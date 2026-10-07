namespace JiuJitsu.Api.Models;

public class StudentClass
{
    public Guid StudentId { get; set; }
    public Guid ClassId { get; set; }

    public Student Student { get; set; } = null!;
    public TrainingClass Class { get; set; } = null!;
}
