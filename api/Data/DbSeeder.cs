using System.Globalization;
using System.Text;
using JiuJitsu.Api.Models;
using JiuJitsu.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace JiuJitsu.Api.Data;

/// <summary>
/// Belts are reference data and are always seeded. Demo data (students, classes, attendance, payments)
/// is only created on an empty database and can be disabled with SEED_DEMO_DATA=false.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, bool seedDemoData)
    {
        if (!await db.Belts.AnyAsync())
        {
            db.Belts.AddRange(CreateBelts());
            await db.SaveChangesAsync();
        }

        if (seedDemoData && !await db.Students.AnyAsync())
        {
            await SeedDemoDataAsync(db);
        }
    }

    private static List<Belt> CreateBelts() =>
    [
        .. BeltRules.AdultBeltNames.Select((name, i) => new Belt
        {
            Id = Guid.NewGuid(), Name = name, Category = BeltCategory.Adult, Order = i + 1
        }),
        .. BeltRules.ChildBeltNames.Select((name, i) => new Belt
        {
            Id = Guid.NewGuid(), Name = name, Category = BeltCategory.Child, Order = i + 1
        })
    ];

    private static async Task SeedDemoDataAsync(AppDbContext db)
    {
        var rng = new Random(42);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTime.UtcNow;

        var belts = await db.Belts.ToListAsync();
        var adultBelts = belts.Where(b => b.Category == BeltCategory.Adult).OrderBy(b => b.Order).ToList();
        var childBelts = belts.Where(b => b.Category == BeltCategory.Child).OrderBy(b => b.Order).ToList();

        // Classes
        var adultClass = NewClass("Jiu-Jitsu Adulto", "Turma principal com kimono", [1, 3, 5], 19, 0, 20, 30, StudentType.Adult);
        var childClass = NewClass("Jiu-Jitsu Infantil", "Turma kids de 5 a 13 anos", [2, 4], 18, 0, 19, 0, StudentType.Child);
        var morningClass = NewClass("Jiu-Jitsu Manhã", "Treino cedo para quem trabalha", [2, 4], 7, 0, 8, 0, StudentType.Adult);
        var noGiClass = NewClass("No-Gi", "Treino sem kimono", [6], 10, 0, 11, 30, StudentType.Adult);
        var classes = new[] { adultClass, childClass, morningClass, noGiClass };
        db.Classes.AddRange(classes);

        // Responsibles (Silva, Costa and Rocha siblings share parents)
        var r = new Dictionary<string, Responsible>();
        foreach (var (name, phone) in new[]
                 {
                     ("Maria Silva", "(11) 99999-2001"), ("Roberto Silva", "(11) 98888-2002"),
                     ("Ana Costa", "(11) 99999-2003"), ("Carlos Costa", "(11) 98888-2004"),
                     ("Lúcia Lima", "(11) 99999-2005"), ("Paulo Santos", "(11) 98888-2006"),
                     ("Fernanda Oliveira", "(11) 99999-2007"), ("Juliana Rocha", "(11) 99999-2008"),
                     ("Ricardo Rocha", "(11) 98888-2009"), ("Helena Mendes", "(11) 99999-2010"),
                     ("Sérgio Almeida", "(11) 98888-2011"), ("Camila Dias", "(11) 99999-2012")
                 })
        {
            r[name] = new Responsible { Id = Guid.NewGuid(), Name = name, Phone = phone, Email = EmailFor(name) };
        }
        db.Responsibles.AddRange(r.Values);

        var students = new List<Student>();
        var attendanceProfile = new Dictionary<Guid, double>();

        Student AddStudent(string name, StudentType type, int age, int monthsSinceJoined, Belt belt, int degree,
            decimal fee, bool active = true, double attendanceRate = 0.82)
        {
            var student = new Student
            {
                Id = Guid.NewGuid(),
                Name = name,
                StudentType = type,
                BirthDate = today.AddYears(-age).AddDays(-rng.Next(1, 360)),
                JoinedAt = today.AddMonths(-monthsSinceJoined).AddDays(-rng.Next(0, 20)),
                Active = active,
                CurrentBeltId = belt.Id,
                CurrentDegree = degree,
                MonthlyFee = fee,
                CreatedAt = now,
                UpdatedAt = now
            };
            if (type == StudentType.Adult)
            {
                student.Email = EmailFor(name);
                student.Phone = $"(11) 9{rng.Next(7000, 9999)}-{rng.Next(1000, 9999)}";
            }
            students.Add(student);
            attendanceProfile[student.Id] = attendanceRate;
            return student;
        }

        // Adults: (name, age, months training, belt index, degree, fee, active, attendance)
        var adultDefs = new (string, int, int, int, int, decimal, bool, double)[]
        {
            ("Pedro Santos", 29, 10, 0, 2, 180m, true, 0.45),
            ("Lucas Oliveira", 24, 8, 0, 1, 160m, true, 0.48),
            ("Rafael Costa", 33, 40, 2, 1, 200m, true, 0.86),
            ("Bruno Almeida", 27, 14, 0, 4, 160m, true, 0.52),
            ("Felipe Rocha", 38, 72, 3, 0, 220m, true, 0.9),
            ("André Martins", 31, 30, 1, 3, 180m, true, 0.8),
            ("Thiago Mendes", 22, 3, 0, 0, 160m, true, 0.75),
            ("Gustavo Lima", 35, 48, 2, 0, 200m, true, 0.84),
            ("Diego Ferreira", 42, 120, 4, 1, 0m, true, 0.92),
            ("Marcos Souza", 28, 26, 1, 1, 180m, true, 0.7),
            ("Carlos Nunes", 30, 12, 0, 2, 160m, false, 0.3),
            ("Ricardo Barbosa", 36, 66, 3, 2, 220m, true, 0.88),
            ("Paula Azevedo", 26, 36, 1, 4, 180m, true, 0.79),
            ("Henrique Dias", 19, 5, 0, 1, 150m, true, 0.83),
        };

        var joao = AddStudent("João Silva", StudentType.Adult, 30, 28, adultBelts[1], 0, 180m);
        foreach (var (name, age, months, beltIdx, degree, fee, active, rate) in adultDefs)
            AddStudent(name, StudentType.Adult, age, months, adultBelts[beltIdx], degree, fee, active, rate);

        // Children: (name, age, months training, belt index, degree, fee, responsibles with relationship)
        var childDefs = new (string, int, int, int, int, decimal, (string, string)[])[]
        {
            ("Ana Silva", 8, 24, 2, 1, 140m, [("Maria Silva", "Mãe"), ("Roberto Silva", "Pai")]),
            ("Pedro Silva", 11, 40, 5, 0, 140m, [("Maria Silva", "Mãe"), ("Roberto Silva", "Pai")]),
            ("Lucas Costa", 7, 10, 1, 2, 130m, [("Ana Costa", "Mãe"), ("Carlos Costa", "Pai")]),
            ("Gabriel Costa", 9, 30, 4, 1, 130m, [("Ana Costa", "Mãe"), ("Carlos Costa", "Pai")]),
            ("Sofia Lima", 6, 5, 0, 1, 120m, [("Lúcia Lima", "Mãe")]),
            ("Miguel Santos", 12, 60, 8, 2, 150m, [("Paulo Santos", "Pai")]),
            ("Lara Oliveira", 8, 18, 3, 0, 140m, [("Fernanda Oliveira", "Mãe")]),
            ("Enzo Rocha", 10, 36, 6, 3, 140m, [("Juliana Rocha", "Mãe"), ("Ricardo Rocha", "Pai")]),
            ("Alice Rocha", 7, 12, 1, 0, 140m, [("Juliana Rocha", "Mãe"), ("Ricardo Rocha", "Pai")]),
            ("Isabela Mendes", 9, 20, 2, 3, 130m, [("Helena Mendes", "Avó")]),
            ("Theo Almeida", 13, 72, 11, 1, 150m, [("Sérgio Almeida", "Pai")]),
            ("Valentina Dias", 5, 2, 0, 0, 120m, [("Camila Dias", "Mãe")]),
        };

        foreach (var (name, age, months, beltIdx, degree, fee, links) in childDefs)
        {
            var rate = name is "Lucas Costa" ? 0.4 : 0.85;
            var child = AddStudent(name, StudentType.Child, age, months, childBelts[beltIdx], degree, fee, attendanceRate: rate);
            for (var i = 0; i < links.Length; i++)
            {
                child.Responsibles.Add(new StudentResponsible
                {
                    StudentId = child.Id,
                    ResponsibleId = r[links[i].Item1].Id,
                    Relationship = links[i].Item2,
                    IsPrimary = i == 0
                });
            }
        }

        db.Students.AddRange(students);

        // Graduation history
        var graduations = new List<Graduation>();
        graduations.AddRange(new (int Belt, int Degree, DateOnly Date)[]
        {
            (0, 0, new DateOnly(2024, 6, 10)),
            (0, 1, new DateOnly(2025, 1, 10)),
            (0, 2, new DateOnly(2025, 7, 10)),
            (0, 3, new DateOnly(2026, 2, 15)),
            (1, 0, new DateOnly(2026, 8, 20)),
        }.Where(g => g.Date <= today).Select(g => NewGraduation(joao, adultBelts[g.Belt], g.Degree, g.Date, now)));
        joao.JoinedAt = new DateOnly(2024, 6, 10);

        foreach (var student in students.Where(s => s != joao))
        {
            var system = student.StudentType == StudentType.Adult ? adultBelts : childBelts;
            graduations.AddRange(BuildHistory(student, system, today, rng, now));
        }
        db.Graduations.AddRange(graduations);

        // Enrollment
        foreach (var student in students)
        {
            if (student.StudentType == StudentType.Child)
            {
                student.Classes.Add(new StudentClass { StudentId = student.Id, ClassId = childClass.Id });
                continue;
            }

            student.Classes.Add(new StudentClass { StudentId = student.Id, ClassId = adultClass.Id });
            if (rng.NextDouble() < 0.4)
                student.Classes.Add(new StudentClass { StudentId = student.Id, ClassId = morningClass.Id });
            if (adultBelts.First(b => b.Id == student.CurrentBeltId).Order >= 2 && rng.NextDouble() < 0.6)
                student.Classes.Add(new StudentClass { StudentId = student.Id, ClassId = noGiClass.Id });
        }

        // Attendance for the last 60 days (today is left empty so the roll call can be demoed)
        var attendances = new List<Attendance>();
        foreach (var student in students)
        {
            foreach (var enrollment in student.Classes)
            {
                var trainingClass = classes.First(c => c.Id == enrollment.ClassId);
                for (var d = 1; d <= 60; d++)
                {
                    var date = today.AddDays(-d);
                    if (date < student.JoinedAt || !trainingClass.DaysOfWeek.Contains((int)date.DayOfWeek))
                        continue;
                    if (!student.Active && d < 45)
                        continue;

                    attendances.Add(new Attendance
                    {
                        Id = Guid.NewGuid(),
                        StudentId = student.Id,
                        ClassId = trainingClass.Id,
                        Date = date,
                        Present = rng.NextDouble() < attendanceProfile[student.Id]
                    });
                }
            }
        }
        db.Attendances.AddRange(attendances);

        // Payments for the current month and the previous 3
        var payments = new List<Payment>();
        foreach (var student in students.Where(s => s.MonthlyFee > 0))
        {
            for (var m = 0; m < 4; m++)
            {
                var monthStart = new DateOnly(today.Year, today.Month, 1).AddMonths(-m);
                if (monthStart < new DateOnly(student.JoinedAt.Year, student.JoinedAt.Month, 1))
                    continue;
                if (!student.Active && m < 2)
                    continue;

                var due = monthStart.AddDays(9);
                var paidChance = m == 0 ? (due < today ? 0.65 : 0.4) : (attendanceProfile[student.Id] < 0.55 ? 0.6 : 0.95);
                var paid = rng.NextDouble() < paidChance;

                payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    StudentId = student.Id,
                    Amount = student.MonthlyFee,
                    DueDate = due,
                    PaidAt = paid ? Min(due.AddDays(rng.Next(-5, 4)), today) : null,
                    Status = paid ? PaymentStatus.Paid : due < today ? PaymentStatus.Overdue : PaymentStatus.Pending,
                    Notes = paid && rng.NextDouble() < 0.2 ? "Pago em dinheiro" : null
                });
            }
        }
        db.Payments.AddRange(payments);

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Builds a plausible history ending at the student's current belt/degree, spread between
    /// the join date and today. Starts up to two belts below the current one.
    /// </summary>
    private static IEnumerable<Graduation> BuildHistory(Student student, List<Belt> system, DateOnly today, Random rng, DateTime now)
    {
        var currentIdx = system.FindIndex(b => b.Id == student.CurrentBeltId);
        var startIdx = Math.Max(0, currentIdx - 2);

        var steps = new List<(Belt Belt, int Degree)>();
        for (var i = startIdx; i <= currentIdx; i++)
        {
            var lastDegree = i == currentIdx ? student.CurrentDegree : 4;
            for (var d = 0; d <= lastDegree; d++)
            {
                if (i < currentIdx && d > 0 && d < 4 && rng.NextDouble() < 0.3)
                    continue;
                steps.Add((system[i], d));
            }
        }

        var lastDate = today.AddDays(-rng.Next(20, 90));
        if (lastDate < student.JoinedAt)
            lastDate = student.JoinedAt;
        var totalDays = lastDate.DayNumber - student.JoinedAt.DayNumber;

        for (var s = 0; s < steps.Count; s++)
        {
            var offset = steps.Count == 1 ? 0 : totalDays * s / (steps.Count - 1);
            var date = student.JoinedAt.AddDays(offset);
            yield return NewGraduation(student, steps[s].Belt, steps[s].Degree, date, now);
        }
    }

    private static Graduation NewGraduation(Student student, Belt belt, int degree, DateOnly date, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        StudentId = student.Id,
        BeltId = belt.Id,
        Degree = degree,
        Date = date,
        Notes = null,
        CreatedAt = now
    };

    private static TrainingClass NewClass(string name, string description, int[] days, int startH, int startM, int endH, int endM, StudentType type) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Description = description,
        DaysOfWeek = days,
        StartTime = new TimeOnly(startH, startM),
        EndTime = new TimeOnly(endH, endM),
        Active = true,
        TargetStudentType = type
    };

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;

    private static string EmailFor(string name)
    {
        var ascii = new string(name.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray()).ToLowerInvariant();
        var parts = ascii.Split(' ');
        return $"{parts[0]}.{parts[^1]}@email.com";
    }
}
