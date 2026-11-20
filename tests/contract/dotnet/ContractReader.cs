#:package Microsoft.OpenApi@2.12.2
#:package Microsoft.OpenApi.YamlReader@2.12.2
using Microsoft.OpenApi;
using Microsoft.OpenApi.Reader;
using Microsoft.OpenApi.YamlReader;

if (args.Length != 1) { Console.Error.WriteLine("usage: ContractReader <openapi.yaml>"); return 1; }
var settings = new OpenApiReaderSettings();
settings.AddYamlReader();
async Task<int> Load(string path)
{
    try
    {
        var result = await OpenApiDocument.LoadAsync(path, settings: settings);
        var diagnostic = result.Diagnostic ?? throw new InvalidOperationException("Reader returned no diagnostic");
        foreach (var warning in diagnostic.Warnings) Console.WriteLine($"warning: {warning.Message}");
        foreach (var error in diagnostic.Errors) Console.Error.WriteLine($"error: {error.Message}");
        Console.WriteLine($"spec={diagnostic.SpecificationVersion} paths={result.Document?.Paths?.Count} errors={diagnostic.Errors.Count} warnings={diagnostic.Warnings.Count}");
        return diagnostic.Errors.Count == 0 && result.Document is not null ? 0 : 1;
    }
    catch (Exception ex) { Console.Error.WriteLine($"reader error: {ex.Message}"); return 1; }
}
var good = await Load(args[0]);
if (good != 0) return good;
var text = await File.ReadAllTextAsync(args[0]);
if (!text.Contains("openapi: 3.1.0")) { Console.Error.WriteLine("N-17 mutation target missing"); return 1; }
var badPath = Path.Combine(Path.GetTempPath(), $"p02-openapi-{Guid.NewGuid():N}.yaml");
try
{
    await File.WriteAllTextAsync(badPath, text.Replace("openapi: 3.1.0", "openapi: 9.9.9"));
    var bad = await Load(badPath);
    if (bad == 0) { Console.Error.WriteLine("N-17 failed: invalid version loaded"); return 1; }
    Console.WriteLine("N-17: invalid version rejected");
    const string oldRef = "#/components/schemas/ResumeDocument";
    if (!text.Contains(oldRef)) { Console.Error.WriteLine("N-18 mutation target missing"); return 1; }
    await File.WriteAllTextAsync(badPath, text.Replace(oldRef, "#/components/schemas/DoesNotExist", StringComparison.Ordinal));
    var missing = await Load(badPath);
    Console.WriteLine($"N-18: missing ref reader exit={missing} (Should, diagnostic recorded)");
    return 0;
}
finally { File.Delete(badPath); }
