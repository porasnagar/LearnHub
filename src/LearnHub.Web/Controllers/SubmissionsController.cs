using LearnHub.Web.Data;
using LearnHub.Web.Infrastructure;
using LearnHub.Web.Models;
using LearnHub.Web.Services;
using LearnHub.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnHub.Web.Controllers;

/// <summary>The grading screen: one submission at a time, with previous / next navigation.</summary>
[Authorize(Roles = "Instructor,Admin")]
public class SubmissionsController(LmsDbContext db, LmsService lms) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Grade(int id)
    {
        var submission = await LoadAsync(id);
        if (submission is null) return NotFound();
        if (!LmsService.CanManage(submission.Assignment!.Course!, User.GetUserId(), User.GetRole())) return Forbid();

        var model = new GradeViewModel { SubmissionId = id, Score = submission.Score, Feedback = submission.Feedback };
        await FillAsync(model, submission);
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Grade(GradeViewModel model)
    {
        if (ModelState.IsValid)
        {
            var result = await lms.GradeAsync(model.SubmissionId, User.GetUserId(), User.GetRole(), model.Score!.Value, model.Feedback);
            if (result.Succeeded)
            {
                var assignmentId = await db.Submissions.Where(s => s.Id == model.SubmissionId)
                    .Select(s => s.AssignmentId).SingleAsync();
                if (model.SaveAndNext)
                {
                    var queue = await QueueAsync(assignmentId);
                    var next = queue.SkipWhile(q => q.SubmissionId != model.SubmissionId).Skip(1)
                        .Concat(queue.TakeWhile(q => q.SubmissionId != model.SubmissionId))
                        .FirstOrDefault(q => !q.IsGraded);
                    if (next is not null)
                    {
                        TempData["Success"] = "Grade saved. Here's the next submission.";
                        return RedirectToAction(nameof(Grade), new { id = next.SubmissionId });
                    }
                    TempData["Success"] = "Grade saved. Every submission for this assignment is graded.";
                }
                else
                {
                    TempData["Success"] = "Grade saved.";
                }
                return RedirectToAction("Details", "Assignments", new { id = assignmentId });
            }
            ModelState.AddModelError(string.Empty, result.Error!);
        }

        var submission = await LoadAsync(model.SubmissionId);
        if (submission is null) return NotFound();
        await FillAsync(model, submission);
        return View(model);
    }

    private async Task FillAsync(GradeViewModel model, Submission submission)
    {
        model.Submission = submission;
        model.Queue = await QueueAsync(submission.AssignmentId);
        var index = model.Queue.FindIndex(q => q.SubmissionId == submission.Id);
        model.Position = index + 1;
        model.PrevId = index > 0 ? model.Queue[index - 1].SubmissionId : null;
        model.NextId = index >= 0 && index < model.Queue.Count - 1 ? model.Queue[index + 1].SubmissionId : null;
    }

    private Task<List<GradeQueueItem>> QueueAsync(int assignmentId) =>
        db.Submissions.Where(s => s.AssignmentId == assignmentId)
            .OrderBy(s => s.Student!.FullName)
            .Select(s => new GradeQueueItem(s.Id, s.Student!.FullName, s.Score != null))
            .ToListAsync();

    private Task<Submission?> LoadAsync(int id) =>
        db.Submissions
            .Include(s => s.Student)
            .Include(s => s.Assignment).ThenInclude(a => a!.Course)
            .SingleOrDefaultAsync(s => s.Id == id);
}
