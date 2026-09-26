using Microsoft.Extensions.Options;

namespace LearnHub.Web.Services;

public class UploadOptions
{
    public int MaxFileSizeMB { get; set; } = 10;
    public string[] AllowedExtensions { get; set; } = [];
}

/// <summary>
/// Stores submission attachments under App_Data/uploads (outside wwwroot, so files are
/// only reachable through the authorized download action) using random file names.
/// </summary>
public class FileStorageService(IWebHostEnvironment env, IOptions<UploadOptions> options)
{
    private readonly UploadOptions _options = options.Value;

    private string Root => Path.Combine(env.ContentRootPath, "App_Data", "uploads");

    public string AllowedExtensionsText => string.Join(", ", _options.AllowedExtensions);

    public int MaxFileSizeMB => _options.MaxFileSizeMB;

    /// <returns>An error message, or null if the file is acceptable.</returns>
    public string? Validate(IFormFile file)
    {
        if (file.Length == 0) return "The selected file is empty.";
        if (file.Length > _options.MaxFileSizeMB * 1024L * 1024L)
            return $"Files must be {_options.MaxFileSizeMB} MB or smaller.";

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_options.AllowedExtensions.Contains(ext))
            return $"File type '{ext}' is not allowed. Allowed: {AllowedExtensionsText}.";
        return null;
    }

    public async Task<string> SaveAsync(IFormFile file)
    {
        Directory.CreateDirectory(Root);
        var storedName = Guid.NewGuid().ToString("N") + Path.GetExtension(file.FileName).ToLowerInvariant();
        await using var stream = File.Create(Path.Combine(Root, storedName));
        await file.CopyToAsync(stream);
        return storedName;
    }

    public Stream? OpenRead(string storedName)
    {
        var path = Path.Combine(Root, Path.GetFileName(storedName));
        return File.Exists(path) ? File.OpenRead(path) : null;
    }

    public void Delete(string? storedName)
    {
        if (string.IsNullOrEmpty(storedName)) return;
        var path = Path.Combine(Root, Path.GetFileName(storedName));
        if (File.Exists(path)) File.Delete(path);
    }
}
