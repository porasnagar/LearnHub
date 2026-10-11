using LearnHub.Web.Data;
using LearnHub.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace LearnHub.Web.Api;

/// <summary>
/// Read-only database explorer for administrators (a built-in "Prisma Studio"):
/// every table with its row count, columns, keys and relationships, live rows page by page,
/// and the schema as SQL. Everything is read from EF Core's model, so it always matches the code.
/// Nothing here writes, and table names are matched against the model, never put into SQL.
/// </summary>
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/database")]
public class DatabaseController(LmsDbContext db) : ApiControllerBase
{
    private const int MaxPageSize = 100;

    [HttpGet]
    public async Task<DbOverviewDto> Overview()
    {
        var tables = new List<DbTableDto>();
        foreach (var et in Entities())
            tables.Add(new DbTableDto(et.GetTableName()!, et.ClrType.Name, await CountAsync(et.GetTableName()!), Columns(et), Indexes(et)));

        long? size = null;
        var file = db.Database.IsSqlite() ? db.Database.GetDbConnection().DataSource : null;
        if (!string.IsNullOrEmpty(file) && System.IO.File.Exists(file)) size = new FileInfo(file).Length;

        return new DbOverviewDto(ProviderName(), size, tables.Sum(t => t.Rows), tables);
    }

    /// <summary>One page of a table's rows, oldest first. Password hashes are masked.</summary>
    [HttpGet("tables/{table}")]
    public async Task<ActionResult<DbRowsDto>> Rows(string table, int page = 1, int pageSize = 25)
    {
        var et = Entities().FirstOrDefault(e => string.Equals(e.GetTableName(), table, StringComparison.OrdinalIgnoreCase));
        if (et is null) return NotFound(new ApiError($"There is no table named '{table}'."));

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var name = et.GetTableName()!;
        var total = await CountAsync(name);
        var entities = await PageAsync(name, (page - 1) * pageSize, pageSize);

        var props = Ordered(et);
        var rows = entities.Select(e => props.ToDictionary(p => p.GetColumnName(), p => Display(p, p.PropertyInfo?.GetValue(e)))).ToList();
        return new DbRowsDto(name, page, pageSize, total, props.Select(p => p.GetColumnName()).ToList(), rows);
    }

    /// <summary>The CREATE TABLE / CREATE INDEX script for the current model, as EF Core generates it.</summary>
    [HttpGet("schema.sql")]
    public ContentResult Schema() => Content(db.Database.GenerateCreateScript(), "text/plain; charset=utf-8");

    // ---------- model metadata ----------

    private IEnumerable<IEntityType> Entities() =>
        db.Model.GetEntityTypes().Where(e => e.GetTableName() is not null).OrderBy(e => Order(e.GetTableName()!));

    /// <summary>Parents before children, so the list reads like the ER diagram.</summary>
    private static int Order(string table) => table switch
    {
        "Users" => 0, "Courses" => 1, "Enrollments" => 2, "Assignments" => 3, "Submissions" => 4, "Announcements" => 5, _ => 9
    };

    private static List<DbColumnDto> Columns(IEntityType et)
    {
        var uniques = et.GetIndexes().Where(i => i.IsUnique && i.Properties.Count == 1).Select(i => i.Properties[0].Name).ToHashSet();
        return Ordered(et).Select(p =>
        {
            var fk = p.GetContainingForeignKeys().FirstOrDefault();
            return new DbColumnDto(
                p.GetColumnName(),
                p.GetColumnType(),
                ClrName(p.ClrType),
                p.IsNullable,
                p.IsPrimaryKey(),
                fk is null ? null : $"{fk.PrincipalEntityType.GetTableName()}.{fk.PrincipalKey.Properties[0].GetColumnName()}",
                fk is null ? null : fk.DeleteBehavior.ToString(),
                uniques.Contains(p.Name),
                p.GetMaxLength());
        }).ToList();
    }

    /// <summary>Columns in the order the class declares them (EF's own order is key first, then alphabetical).</summary>
    private static List<IProperty> Ordered(IEntityType et)
    {
        var declared = et.ClrType.GetProperties().Select(p => p.Name).ToList();
        return et.GetProperties().OrderBy(p => p.IsPrimaryKey() ? -1 : declared.IndexOf(p.Name)).ToList();
    }

    /// <summary>C# type as written in the entity: "Int32", "String", "Double?".</summary>
    private static string ClrName(Type t) => Nullable.GetUnderlyingType(t) is { } inner ? inner.Name + "?" : t.Name;

    private static List<string> Indexes(IEntityType et) =>
        et.GetIndexes().Select(i => $"{(i.IsUnique ? "UNIQUE " : "")}({string.Join(", ", i.Properties.Select(p => p.GetColumnName()))})").ToList();

    private string ProviderName() =>
        db.Database.IsSqlite() ? "SQLite" : db.Database.ProviderName?.Split('.').LastOrDefault() ?? "Unknown";

    // ---------- typed queries per table (no table name ever goes into SQL) ----------

    private Task<int> CountAsync(string table) => table switch
    {
        "Users" => db.Users.CountAsync(),
        "Courses" => db.Courses.CountAsync(),
        "Enrollments" => db.Enrollments.CountAsync(),
        "Assignments" => db.Assignments.CountAsync(),
        "Submissions" => db.Submissions.CountAsync(),
        "Announcements" => db.Announcements.CountAsync(),
        _ => Task.FromResult(0)
    };

    private async Task<List<object>> PageAsync(string table, int skip, int take) => table switch
    {
        "Users" => [.. await db.Users.AsNoTracking().OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync()],
        "Courses" => [.. await db.Courses.AsNoTracking().OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync()],
        "Enrollments" => [.. await db.Enrollments.AsNoTracking().OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync()],
        "Assignments" => [.. await db.Assignments.AsNoTracking().OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync()],
        "Submissions" => [.. await db.Submissions.AsNoTracking().OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync()],
        "Announcements" => [.. await db.Announcements.AsNoTracking().OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync()],
        _ => []
    };

    /// <summary>What an admin sees in a cell. A password hash shows only its start, to prove it is hashed.</summary>
    private static object? Display(IProperty p, object? value) => value switch
    {
        null => null,
        string s when p.Name == nameof(AppUser.PasswordHash) => s.Length > 14 ? s[..14] + "… (PBKDF2 hash, hidden)" : "(hidden)",
        Enum e => e.ToString(),
        _ => value
    };
}
