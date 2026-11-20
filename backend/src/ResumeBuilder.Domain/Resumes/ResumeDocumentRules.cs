namespace ResumeBuilder.Domain.Resumes;

/// <summary>Where and why a request failed. Never carries the submitted value (T-ID-05).</summary>
public sealed record DocumentIssue(string Location, string JsonPointer, string Code);

public sealed record DocumentWarning(string JsonPointer, string Code);

/// <summary>Rules JSON Schema cannot express: R-4, R-7 and R-12.</summary>
public static class ResumeDocumentRules
{
  public static IReadOnlyList<DocumentIssue> Validate(ResumeDocument document, string basePointer = "")
  {
    ArgumentNullException.ThrowIfNull(document);
    var issues = new List<DocumentIssue>();
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    void Id(string id, string at)
    {
      if (!seen.Add(id)) issues.Add(new DocumentIssue("body", $"{basePointer}{at}/id", "duplicate_id"));
    }

    for (var c = 0; c < document.Header.Contacts.Count; c++) Id(document.Header.Contacts[c].Id, $"/header/contacts/{c}");
    for (var s = 0; s < document.Sections.Count; s++)
    {
      var section = document.Sections[s];
      Id(section.Id, $"/sections/{s}");
      if (section is ListSection list)
        for (var i = 0; i < list.Items.Count; i++) Id(list.Items[i].Id, $"/sections/{s}/content/items/{i}");
      if (section is EntriesSection entries)
        for (var e = 0; e < entries.Entries.Count; e++) Id(entries.Entries[e].Id, $"/sections/{s}/content/entries/{e}");
    }

    if (TotalText(document) > ResumeLimits.TotalText) issues.Add(new DocumentIssue("body", basePointer, "resume_text_limit_exceeded"));
    return issues;
  }

  public static IReadOnlyList<DocumentWarning> Warnings(ResumeDocument document)
  {
    ArgumentNullException.ThrowIfNull(document);
    var warnings = new List<DocumentWarning>();
    for (var s = 0; s < document.Sections.Count; s++)
    {
      if (document.Sections[s] is not EntriesSection section) continue;
      for (var e = 0; e < section.Entries.Count; e++)
        if (IsInverted(section.Entries[e])) warnings.Add(new DocumentWarning($"/sections/{s}/content/entries/{e}/end", "date_range_inverted"));
    }
    return warnings;
  }

  public static int CodePoints(string value)
  {
    ArgumentNullException.ThrowIfNull(value);
    var count = 0;
    foreach (var _ in value.EnumerateRunes()) count++;
    return count;
  }

  /// <summary>R-7. Dates compare at the precision both sides have: a year-only date is not after a date in the same year.</summary>
  private static bool IsInverted(ResumeEntry entry)
  {
    if (entry.Start is not { } start || entry.End is not PartialDate end) return false;
    if (start.Year != end.Year) return start.Year > end.Year;
    return start.Month is int from && end.Month is int to && from > to;
  }

  private static int TotalText(ResumeDocument document)
  {
    var total = CodePoints(document.Title) + CodePoints(document.Header.FullName) + CodePoints(document.Header.Headline);
    foreach (var contact in document.Header.Contacts) total += CodePoints(contact.Text) + CodePoints(contact.Url ?? "");
    foreach (var section in document.Sections)
    {
      total += CodePoints(section.Title);
      total += section switch
      {
        TextSection text => Blocks(text.Body),
        InlineSection inline => Inlines(inline.Body.Inlines),
        ListSection list => list.Items.Sum(item => Inlines(item.Text)),
        EntriesSection entries => Labels(entries.Labels) + entries.Entries.Sum(Entry),
        _ => 0,
      };
    }
    return total;
  }

  private static int Labels(EntryLabels? labels) =>
    labels is null ? 0 : CodePoints(labels.Title ?? "") + CodePoints(labels.Organization ?? "") + CodePoints(labels.Location ?? "");

  private static int Entry(ResumeEntry entry) =>
    CodePoints(entry.Title) + CodePoints(entry.Organization) + CodePoints(entry.Location) + CodePoints(entry.DateText) + Blocks(entry.Description);

  private static int Blocks(IReadOnlyList<RichBlock> blocks) => blocks.Sum(block => block switch
  {
    ParagraphBlock paragraph => Inlines(paragraph.Inlines),
    BulletListBlock bullets => bullets.Items.Sum(Inlines),
    _ => 0,
  });

  private static int Inlines(IReadOnlyList<RichInline> inlines) => inlines.Sum(inline => inline switch
  {
    TextRun run => CodePoints(run.Value),
    LinkInline link => CodePoints(link.Url) + link.Children.Sum(child => CodePoints(child.Value)),
    _ => 0,
  });
}

public static class SafeUrl
{
  private static readonly string[] Schemes = ["https://", "http://", "mailto:", "tel:"];

  /// <summary>R-6: lower-case https, http, mailto or tel; no whitespace or control characters; at most 2048 code points.</summary>
  public static bool IsValid(string value)
  {
    ArgumentNullException.ThrowIfNull(value);
    if (ResumeDocumentRules.CodePoints(value) > ResumeLimits.Url) return false;
    var scheme = Array.Find(Schemes, candidate => value.StartsWith(candidate, StringComparison.Ordinal));
    if (scheme is null || value.Length == scheme.Length) return false;
    foreach (var c in value)
      if (char.IsWhiteSpace(c) || char.IsControl(c)) return false;
    return true;
  }
}
