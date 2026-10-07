namespace JiuJitsu.Api.Models;

public class Belt
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public BeltCategory Category { get; set; }
    public int Order { get; set; }

    public ICollection<Student> Students { get; set; } = [];
    public ICollection<Graduation> Graduations { get; set; } = [];
}
