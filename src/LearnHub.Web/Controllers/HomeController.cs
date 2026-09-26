using System.Diagnostics;
using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

public class HomeController(LmsDbContext db) : Controller
{
    public async Task<IActionResult> Index()
    {
        // Like any LMS, signed-in users land on their dashboard.
        if (User.Identity?.IsAuthenticated == true) return RedirectToAction("Index", "Dashboard");

        var published = db.Courses.Where(c => c.IsPublished);
        return View(new HomeViewModel
        {
            Subjects = await published.GroupBy(c => c.Category)
                .OrderByDescending(g => g.Count()).ThenBy(g => g.Key)
                .Select(g => new SubjectCount(g.Key, g.Count()))
                .ToListAsync(),
            Featured = await published.ToCards(studentId: null)
                .OrderByDescending(c => c.StudentCount).ThenBy(c => c.Code)
                .Take(3)
                .ToListAsync()
        });
    }

    public IActionResult About() => View();

    [Route("/Home/Status")]
    public IActionResult Status(int code)
    {
        ViewBag.Code = code;
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() =>
        View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
}
