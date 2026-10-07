using JiuJitsu.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Belt> Belts => Set<Belt>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Responsible> Responsibles => Set<Responsible>();
    public DbSet<StudentResponsible> StudentResponsibles => Set<StudentResponsible>();
    public DbSet<Graduation> Graduations => Set<Graduation>();
    public DbSet<TrainingClass> Classes => Set<TrainingClass>();
    public DbSet<StudentClass> StudentClasses => Set<StudentClass>();
    public DbSet<Attendance> Attendances => Set<Attendance>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Belt>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(80).IsRequired();
            e.HasIndex(x => new { x.Category, x.Order }).IsUnique();
        });

        modelBuilder.Entity<Student>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Email).HasMaxLength(160);
            e.Property(x => x.MonthlyFee).HasPrecision(10, 2);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.HasOne(x => x.CurrentBelt)
                .WithMany(x => x.Students)
                .HasForeignKey(x => x.CurrentBeltId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Name);
            e.HasIndex(x => x.Active);
            e.HasIndex(x => x.StudentType);
        });

        modelBuilder.Entity<Responsible>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Email).HasMaxLength(160);
            e.Property(x => x.Notes).HasMaxLength(2000);
        });

        modelBuilder.Entity<StudentResponsible>(e =>
        {
            e.HasKey(x => new { x.StudentId, x.ResponsibleId });
            e.Property(x => x.Relationship).HasMaxLength(80).IsRequired();
            e.HasOne(x => x.Student)
                .WithMany(x => x.Responsibles)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Responsible)
                .WithMany(x => x.Students)
                .HasForeignKey(x => x.ResponsibleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Graduation>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasOne(x => x.Student)
                .WithMany(x => x.Graduations)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Belt)
                .WithMany(x => x.Graduations)
                .HasForeignKey(x => x.BeltId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.StudentId, x.Date });
        });

        modelBuilder.Entity<TrainingClass>(e =>
        {
            e.ToTable("Classes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<StudentClass>(e =>
        {
            e.HasKey(x => new { x.StudentId, x.ClassId });
            e.HasOne(x => x.Student)
                .WithMany(x => x.Classes)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Class)
                .WithMany(x => x.Students)
                .HasForeignKey(x => x.ClassId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Attendance>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Student)
                .WithMany(x => x.Attendances)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Class)
                .WithMany(x => x.Attendances)
                .HasForeignKey(x => x.ClassId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.StudentId, x.ClassId, x.Date }).IsUnique();
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Amount).HasPrecision(10, 2);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasOne(x => x.Student)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.DueDate);
        });
    }
}
