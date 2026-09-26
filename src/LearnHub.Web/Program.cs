using System.Security.Claims;
using System.Text.Json.Serialization;
using LearnHub.Web.Api;
using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database (Entity Framework Core) ----------
var dataDirectory = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
Directory.CreateDirectory(dataDirectory);
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

using (var scope = app.Services.CreateScope())
{
    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
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
        XsrfCookie.Issue(context, context.RequestServices.GetRequiredService<IAntiforgery>());
    await next();
});

app.MapControllers();
// Unknown /api routes are real 404s; every other path is an Angular route.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
