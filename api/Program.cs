using System.Text.Json;
using System.Text.Json.Serialization;
using JiuJitsu.Api.Data;
using JiuJitsu.Api.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Railway injects PORT. Binding to "*" listens on IPv4 and IPv6 (required by Railway private networking).
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://*:{port}");
}

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

// No authentication yet. Registering authorization keeps the pipeline ready for
// [Authorize] once an external provider (e.g. Google) is added.
builder.Services.AddAuthorization();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(ResolveConnectionString(builder.Configuration)));

builder.Services.AddScoped<StudentService>();
builder.Services.AddScoped<GraduationService>();
builder.Services.AddScoped<AttendanceService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<ClassService>();
builder.Services.AddScoped<ResponsibleService>();

var corsOrigins = builder.Configuration["CORS_ORIGINS"] ?? "http://localhost:3000";
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var (status, message) = error switch
    {
        DomainException ex => (StatusCodes.Status400BadRequest, ex.Message),
        NotFoundException ex => (StatusCodes.Status404NotFound, ex.Message),
        DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } } =>
            (StatusCodes.Status409Conflict, "Registro duplicado."),
        _ => (StatusCodes.Status500InternalServerError, "Erro inesperado. Tente novamente.")
    };

    if (status == StatusCodes.Status500InternalServerError)
    {
        app.Logger.LogError(error, "Unhandled exception");
    }

    context.Response.StatusCode = status;
    await context.Response.WriteAsJsonAsync(new { message });
}));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var seedDemoData = !string.Equals(app.Configuration["SEED_DEMO_DATA"], "false", StringComparison.OrdinalIgnoreCase);
    await DbSeeder.SeedAsync(db, seedDemoData);
}

app.Run();

// On Railway each service only sees its own variables: the API service must declare a reference variable
// such as DATABASE_URL=${{Postgres.DATABASE_URL}} (or PGHOST=${{Postgres.PGHOST}}, etc.).
static string ResolveConnectionString(IConfiguration configuration)
{
    var databaseUrl = configuration["DATABASE_URL"];
    if (!string.IsNullOrWhiteSpace(databaseUrl))
        return ConvertDatabaseUrl(databaseUrl);

    if (!string.IsNullOrWhiteSpace(configuration["PGHOST"]))
    {
        return new NpgsqlConnectionStringBuilder
        {
            Host = configuration["PGHOST"],
            Port = int.TryParse(configuration["PGPORT"], out var pgPort) ? pgPort : 5432,
            Database = configuration["PGDATABASE"],
            Username = configuration["PGUSER"],
            Password = configuration["PGPASSWORD"],
            SslMode = SslMode.Prefer
        }.ConnectionString;
    }

    var connectionString = configuration.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrWhiteSpace(connectionString))
        return connectionString;

    throw new InvalidOperationException(
        "Database not configured. On Railway, add to the API service the reference variable " +
        "DATABASE_URL=${{Postgres.DATABASE_URL}} (use the exact name of your Postgres service). " +
        "Locally, set ConnectionStrings:DefaultConnection.");
}

static string ConvertDatabaseUrl(string databaseUrl)
{
    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':', 2);

    return new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.Trim('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
        SslMode = SslMode.Prefer
    }.ConnectionString;
}
