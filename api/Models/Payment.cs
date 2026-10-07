namespace JiuJitsu.Api.Models;

public class Payment
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly? PaidAt { get; set; }
    public PaymentStatus Status { get; set; }
    public string? Notes { get; set; }

    public Student Student { get; set; } = null!;
}
