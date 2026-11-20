using System.Text.Json.Nodes;

namespace ResumeBuilder.Application.CvImport;

/// <summary>ADR-055: which model a structuring call uses. The adapter maps each tier to a configured model.</summary>
public enum ImportTier { Primary, Escalation }

public enum StructurerStatus { Draft, Refused, Truncated, Failed, Unavailable }

/// <summary>`structureResumeImport`'s request after contract validation. `SourceText` is the user's CV text: never logged.</summary>
public sealed record ImportRequest(string SourceText, string SourceFormat, int Columns, string? SidebarSide);

/// <summary>What one provider call returned. `DraftJson` is the model's output text: never logged.</summary>
public sealed record StructurerOutcome(StructurerStatus Status, string? DraftJson = null, long InputTokens = 0, long OutputTokens = 0);

/// <summary>The port behind which the Anthropic adapter and the stub sit (ADR-055 §4).</summary>
public interface IImportStructurer
{
  Task<StructurerOutcome> StructureAsync(ImportRequest request, ImportTier tier, CancellationToken cancellationToken);
}

/// <summary>`Field` is a JSON Pointer into the draft as the model returned it.</summary>
public sealed record ImportWarning(string Code, string Field);

/// <summary>One provider call, content-free, for the log.</summary>
public sealed record ImportCall(ImportTier Tier, StructurerStatus Status, long InputTokens, long OutputTokens, TimeSpan Duration);

/// <summary>`Draft` is null when no draft could be produced (503 `import_unavailable`).</summary>
public sealed record ImportOutcome(JsonObject? Draft, bool Escalated, IReadOnlyList<ImportWarning> Warnings, IReadOnlyList<ImportCall> Calls);

public interface IImportUseCases
{
  Task<ImportOutcome> StructureAsync(ImportRequest request, CancellationToken cancellationToken);
}
