using System.Security.Cryptography;
using System.Text;
using ResumeBuilder.Application.CvImport;

namespace ResumeBuilder.Infrastructure.CvImport;

/// <summary>
/// DD-IMP-10: the provider for development and CI. It answers the primary call from `&lt;directory&gt;/&lt;sha256 of the
/// source text&gt;.json` and is unavailable otherwise, so the browser falls back. No network, no key.
/// </summary>
public sealed class StubImportStructurer(string? directory) : IImportStructurer
{
  public async Task<StructurerOutcome> StructureAsync(ImportRequest request, ImportTier tier, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);
    if (tier != ImportTier.Primary || string.IsNullOrEmpty(directory)) return new StructurerOutcome(StructurerStatus.Unavailable);
    var key = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(request.SourceText)));
    var file = Path.Combine(directory, $"{key}.json");
    return File.Exists(file) ? new StructurerOutcome(StructurerStatus.Draft, await File.ReadAllTextAsync(file, cancellationToken)) : new StructurerOutcome(StructurerStatus.Unavailable);
  }
}
