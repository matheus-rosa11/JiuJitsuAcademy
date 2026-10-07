namespace JiuJitsu.Api.Models;

public class Graduation
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public Guid BeltId { get; set; }
    public int Degree { get; set; }
    public DateOnly Date { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    public Student Student { get; set; } = null!;
    public Belt Belt { get; set; } = null!;
}
