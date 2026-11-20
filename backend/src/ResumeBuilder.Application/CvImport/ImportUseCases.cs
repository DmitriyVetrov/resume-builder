using System.Diagnostics;
using System.Text.Json.Nodes;

namespace ResumeBuilder.Application.CvImport;

/// <summary>
/// ADR-055 §5: the primary model's draft is accepted only whole and verbatim. Anything else — a schema failure,
/// a string not in the source, a refusal, truncation or a failed call — costs exactly one escalation, whose
/// draft loses the strings that fail the verbatim check (DD-IMP-08). No draft → `Draft` null (503).
/// </summary>
public sealed class ImportUseCases(IImportStructurer structurer) : IImportUseCases
{
  public async Task<ImportOutcome> StructureAsync(ImportRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);
    var source = new VerbatimSource(request.SourceText);
    var calls = new List<ImportCall>();

    var primary = await Call(ImportTier.Primary);
    if (primary.Status == StructurerStatus.Unavailable) return new ImportOutcome(null, false, [], calls);
    if (primary.Status == StructurerStatus.Draft)
    {
      var check = ImportDraftValidator.Check(primary.DraftJson!, source, drop: false);
      if (check.Draft is not null && check.NotInSource == 0) return new ImportOutcome(check.Draft, false, check.Warnings, calls);
    }

    var escalation = await Call(ImportTier.Escalation);
    if (escalation.Status != StructurerStatus.Draft) return new ImportOutcome(null, true, [], calls);
    var result = ImportDraftValidator.Check(escalation.DraftJson!, source, drop: true);
    if (result.Draft is null || IsEmpty(result.Draft)) return new ImportOutcome(null, true, [], calls);
    return new ImportOutcome(result.Draft, true, result.Warnings, calls);

    async Task<StructurerOutcome> Call(ImportTier tier)
    {
      var started = Stopwatch.GetTimestamp();
      var outcome = await structurer.StructureAsync(request, tier, cancellationToken);
      calls.Add(new ImportCall(tier, outcome.Status, outcome.InputTokens, outcome.OutputTokens, Stopwatch.GetElapsedTime(started)));
      return outcome;
    }
  }

  private static bool IsEmpty(JsonObject draft) => draft["fullName"]!.GetValue<string>().Length == 0 && draft["sections"]!.AsArray().Count == 0;
}
