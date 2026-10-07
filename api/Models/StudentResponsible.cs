namespace JiuJitsu.Api.Models;

public class StudentResponsible
{
    public Guid StudentId { get; set; }
    public Guid ResponsibleId { get; set; }
    public string Relationship { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }

    public Student Student { get; set; } = null!;
    public Responsible Responsible { get; set; } = null!;
}
