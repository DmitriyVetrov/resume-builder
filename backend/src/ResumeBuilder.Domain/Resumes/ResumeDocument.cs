namespace ResumeBuilder.Domain.Resumes;

/// <summary>The canonical resume document (TECHNICAL-SPEC §10.1). Identical in requests, responses and storage.</summary>
public sealed record ResumeDocument(
  string Title,
  string TemplateId,
  int AccentPreset,
  string Language,
  string DateFormat,
  LayoutSettings Layout,
  ResumeHeader Header,
  IReadOnlyList<ResumeSection> Sections);

public sealed record LayoutSettings(
  string FontPreset,
  int SectionSpacing,
  int EntrySpacing,
  int LineSpacing,
  string PageSize,
  PageMargins Margins,
  string? BodyFont);

public sealed record PageMargins(double Top, double Right, double Bottom, double Left);

public sealed record ResumeHeader(string FullName, string Headline, bool ShowPhoto, IReadOnlyList<ContactItem> Contacts);

public sealed record ContactItem(string Id, string Text, string? Url, string Kind);

public abstract record ResumeSection(string Id, string Title, bool Hidden, int? ListColumns, string? Placement);

public sealed record TextSection(string Id, string Title, bool Hidden, int? ListColumns, string? Placement, IReadOnlyList<RichBlock> Body)
  : ResumeSection(Id, Title, Hidden, ListColumns, Placement);

/// <summary>The body of an inline section is exactly one paragraph (R-3).</summary>
public sealed record InlineSection(string Id, string Title, bool Hidden, int? ListColumns, string? Placement, ParagraphBlock Body)
  : ResumeSection(Id, Title, Hidden, ListColumns, Placement);

public sealed record ListSection(string Id, string Title, bool Hidden, int? ListColumns, string? Placement, IReadOnlyList<ResumeListItem> Items)
  : ResumeSection(Id, Title, Hidden, ListColumns, Placement);

public sealed record EntriesSection(string Id, string Title, bool Hidden, int? ListColumns, string? Placement, EntryLabels? Labels, IReadOnlyList<ResumeEntry> Entries)
  : ResumeSection(Id, Title, Hidden, ListColumns, Placement);

public sealed record ResumeListItem(string Id, IReadOnlyList<RichInline> Text);

public sealed record EntryLabels(string? Title, string? Organization, string? Location);

public sealed record ResumeEntry(
  string Id,
  string Title,
  string Organization,
  string Location,
  PartialDate? Start,
  EndDate? End,
  string DateText,
  IReadOnlyList<RichBlock> Description,
  bool PageBreakBefore);

public abstract record EndDate;
public sealed record PresentDate : EndDate;
public sealed record PartialDate(int Year, int? Month) : EndDate;

public abstract record RichBlock;
public sealed record ParagraphBlock(IReadOnlyList<RichInline> Inlines) : RichBlock;
public sealed record BulletListBlock(IReadOnlyList<IReadOnlyList<RichInline>> Items) : RichBlock;

public abstract record RichInline;
public sealed record TextRun(string Value, bool Bold, bool Italic, bool Underline) : RichInline;
public sealed record LinkInline(string Url, IReadOnlyList<TextRun> Children) : RichInline;
public sealed record LineBreakInline : RichInline;
