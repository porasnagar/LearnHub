using System.Security.Claims;
using LearnHub.Web.Data;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
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

// ---------- Application services ----------
builder.Services.AddControllersWithViews(options =>
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()));
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddScoped<LmsService>();
builder.Services.AddScoped<FileStorageService>();
builder.Services.Configure<UploadOptions>(builder.Configuration.GetSection("Uploads"));

// ---------- Authentication & authorization (cookie + roles) ----------
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;

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

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}

// One consistent date/number format across the product, regardless of server or browser locale.
app.UseRequestLocalization(new RequestLocalizationOptions()
    .SetDefaultCulture("en-US").AddSupportedCultures("en-US").AddSupportedUICultures("en-US"));

app.UseStatusCodePagesWithReExecute("/Home/Status", "?code={0}");
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

public partial class Program { }
