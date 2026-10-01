using System.Security.Claims;
using System.Text.Json.Serialization;
using LearnHub.Web.Api;
using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------- Runtime data (database, uploads, login keys) ----------
// Defaults to App_Data next to the app; in production point DataDirectory (env var) at a persistent disk.
var rawDataDir = builder.Configuration["DataDirectory"];
var dataDirectory = !string.IsNullOrWhiteSpace(rawDataDir)
    ? rawDataDir.Trim()
    : Path.Combine(builder.Environment.ContentRootPath, "App_Data");
Directory.CreateDirectory(dataDirectory);
var keysDir = Path.Combine(dataDirectory, "keys");
Directory.CreateDirectory(keysDir);
builder.Configuration["Uploads:Directory"] ??= Path.Combine(dataDirectory, "uploads");

// Keep the cookie-encryption keys on the same disk so sign-ins survive restarts and redeploys.
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keysDir))
    .SetApplicationName("LearnHub");

// Hosting platforms terminate HTTPS at a proxy; trust its X-Forwarded-* headers.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});

// ---------- Database (Entity Framework Core) ----------
var connectionString = builder.Configuration.GetConnectionString("LmsDb")!
    .Replace("|DataDirectory|", dataDirectory);
builder.Services.AddDbContext<LmsDbContext>(options => options.UseSqlite(connectionString));

// ---------- Web API (ASP.NET Core MVC controllers returning JSON) ----------
// AddControllersWithViews registers MVC's anti-forgery filter services (views themselves aren't used).
builder.Services.AddControllersWithViews(options => options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = context =>
    {
        // Validation errors → { message } so the Angular client can show one clear toast.
        var first = context.ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault();
        return new BadRequestObjectResult(new ApiError(string.IsNullOrEmpty(first) ? "Please check the form and try again." : first));
    });
builder.Services.AddAntiforgery(o => o.HeaderName = XsrfCookie.HeaderName);
builder.Services.AddProblemDetails();

builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddScoped<LmsService>();
builder.Services.AddScoped<FileStorageService>();
builder.Services.Configure<UploadOptions>(builder.Configuration.GetSection("Uploads"));

// ---------- Authentication & authorization (cookie + roles) ----------
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "lh.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;

        // An API answers with status codes instead of redirecting to a login page.
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };

        // Sign out users whose account was deleted or whose role changed since they logged in.
        options.Events.OnValidatePrincipal = async context =>
        {
            var db = context.HttpContext.RequestServices.GetRequiredService<LmsDbContext>();
            var idClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var roleClaim = context.Principal?.FindFirstValue(ClaimTypes.Role);
            var valid = int.TryParse(idClaim, out var id)
                        && Enum.TryParse<UserRole>(roleClaim, out var role)
                        && await db.Users.AnyAsync(u => u.Id == id && u.Role == role);
            if (!valid)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Apply / verify the DB schema, then seed demo data.
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<LmsDbContext>();
        await db.Database.EnsureCreatedAsync();
        await DbSeeder.UpgradeSchemaAsync(db);          // add tables introduced after the DB was first created
        await DbSeeder.SeedAsync(scope.ServiceProvider);
        await DbSeeder.SeedAnnouncementsAsync(db);      // demo posts for databases seeded before announcements existed
        logger.LogInformation("Database ready.");
    }
    catch (Exception ex)
    {
        logger.LogCritical(ex, "Startup failed: database seed/migration threw an exception.");
        throw; // Let the process exit so Render knows the deploy failed.
    }
}

app.UseForwardedHeaders();

// Log unhandled exceptions so they appear in the container logs.
app.UseExceptionHandler(exHandler => exHandler.Run(async ctx =>
{
    var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("UnhandledException");
    var feature = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    var ex = feature?.Error;
    if (ex is not null)
        logger.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);

    // If an antiforgery or cryptographic exception was thrown (e.g. from an old cookie from prior deploy):
    if (ex is AntiforgeryValidationException || ex is System.Security.Cryptography.CryptographicException)
    {
        foreach (var key in ctx.Request.Cookies.Keys)
        {
            if (key.StartsWith(".AspNetCore.Antiforgery", StringComparison.OrdinalIgnoreCase)
                || key == XsrfCookie.CookieName
                || key == "lh.auth")
            {
                ctx.Response.Cookies.Delete(key);
            }
        }
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        ctx.Response.ContentType = "application/problem+json";
        await ctx.Response.WriteAsJsonAsync(new { title = "Session expired. Please refresh the page.", status = 400 });
        return;
    }

    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/problem+json";
    await ctx.Response.WriteAsJsonAsync(new { title = "An unexpected error occurred.", status = 500 });
}));

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    // Render terminates TLS externally; only redirect if the scheme is genuinely http
    // (i.e. someone hit the raw internal port). Skip if we can't determine the https port
    // to avoid a redirect loop or 500 on health checks.
    app.Use(async (context, next) =>
    {
        if (context.Request.Scheme == "http")
        {
            var host = context.Request.Host.Host;
            context.Response.Redirect($"https://{host}{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}", permanent: true);
            return;
        }
        await next();
    });
}

// The Angular app is built into wwwroot (see client/angular.json).
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// Give the Angular client an XSRF token on every API read.
app.Use(async (context, next) =>
{
    if (HttpMethods.IsGet(context.Request.Method) && context.Request.Path.StartsWithSegments("/api"))
    {
        try
        {
            XsrfCookie.Issue(context, context.RequestServices.GetRequiredService<IAntiforgery>());
        }
        catch (Exception ex)
        {
            var logger = context.RequestServices.GetService<ILogger<Program>>();
            logger?.LogWarning(ex, "Could not issue XSRF token on {Path}", context.Request.Path);
        }
    }
    await next();
});

app.MapControllers();
// Unknown /api routes are real 404s; every other path is an Angular route.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
