using System.Text.Json;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Application.Resumes;

/// <summary>Parses JSON under the rules the canonical hash and the reader need: depth 64, no duplicate keys, no lone surrogates.</summary>
public static class StrictJson
{
  private static readonly JsonDocumentOptions Options = new() { MaxDepth = ResumeLimits.MaxJsonDepth };

  /// <summary>The parsed document, or null when the input is `malformed_request` (DD-P07-08).</summary>
  public static JsonDocument? Parse(ReadOnlyMemory<byte> utf8)
  {
    JsonDocument document;
    try { document = JsonDocument.Parse(utf8, Options); }
    catch (JsonException) { return null; }
    try
    {
      if (IsDefined(document.RootElement)) return document;
    }
    catch (InvalidOperationException) { /* A lone surrogate or invalid UTF-8 cannot be read as a string. */ }
    document.Dispose();
    return null;
  }

  private static bool IsDefined(JsonElement element)
  {
    switch (element.ValueKind)
    {
      case JsonValueKind.Object:
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
          if (!names.Add(property.Name) || !IsDefined(property.Value)) return false;
        return true;
      case JsonValueKind.Array:
        foreach (var item in element.EnumerateArray())
          if (!IsDefined(item)) return false;
        return true;
      case JsonValueKind.String:
        _ = element.GetString();
        return true;
      default:
        return true;
    }
  }
}

public sealed record DocumentRead(ResumeDocument? Document, IReadOnlyList<DocumentIssue> Issues);

/// <summary>The closed-schema reader: strict JSON to the typed model plus contract issue codes (R-2, R-3, R-5, R-6).</summary>
public static class ResumeDocumentReader
{
  public static DocumentRead Read(JsonElement element, string basePointer = "")
  {
    var reader = new ClosedSchemaReader();
    var document = reader.Document(element, basePointer);
    return reader.Issues.Count == 0 ? new DocumentRead(document, []) : new DocumentRead(null, reader.Issues);
  }
}

/// <summary>Reads one closed object at a time. A value is only used when the read finished without an issue.</summary>
internal sealed class ClosedSchemaReader
{
  private const int MaxIssues = 100;
  private static readonly string[] Templates = ["T1", "T2", "T3", "T4"];
  private static readonly string[] Languages = ["en", "es", "uk"];
  private static readonly string[] DateFormats = ["MonthYearLong", "MonthYearShort", "Numeric", "YearOnly"];
  private static readonly string[] FontPresets = ["S", "M", "L"];
  private static readonly string[] PageSizes = ["A4", "Letter"];
  private static readonly string[] ContactKinds = ["email", "phone", "location", "link", "other"];
  private static readonly string[] Placements = ["main", "sidebar"];
  private static readonly string[] SectionTypes = ["text", "inline", "list", "entries"];
  private static readonly string[] BlockKinds = ["paragraph", "bulletList"];
  private static readonly string[] InlineKinds = ["text", "link", "lineBreak"];
  private static readonly string[] EndKinds = ["date", "present"];

  public List<DocumentIssue> Issues { get; } = [];

  public void Add(string at, string code)
  {
    if (Issues.Count < MaxIssues) Issues.Add(new DocumentIssue("body", at, code));
  }

  public ResumeDocument Document(JsonElement value, string at)
  {
    if (!Closed(value, at, "title", "templateId", "accentPreset", "language", "dateFormat", "layout", "header", "sections")) return null!;
    return new ResumeDocument(
      Text(value, at, "title", 0, ResumeLimits.Title),
      Choice(value, at, "templateId", Templates),
      Int(value, at, "accentPreset", 0, 2),
      Choice(value, at, "language", Languages),
      Choice(value, at, "dateFormat", DateFormats),
      Layout(value, at),
      Header(value, at),
      [.. Items(value, at, "sections", 0, ResumeLimits.Sections).Select(item => Section(item.Value, item.At))]);
  }

  private LayoutSettings Layout(JsonElement parent, string at)
  {
    var here = $"{at}/layout";
    if (!Field(parent, at, "layout", out var value) || !Closed(value, here, "fontPreset", "sectionSpacing", "entrySpacing", "lineSpacing", "pageSize", "margins", "bodyFont")) return null!;
    return new LayoutSettings(
      Choice(value, here, "fontPreset", FontPresets),
      Int(value, here, "sectionSpacing", 0, 20),
      Int(value, here, "entrySpacing", 0, 20),
      Int(value, here, "lineSpacing", 0, 20),
      Choice(value, here, "pageSize", PageSizes),
      Margins(value, here),
      BodyFont(value, here));
  }

  private PageMargins Margins(JsonElement parent, string at)
  {
    var here = $"{at}/margins";
    if (!Field(parent, at, "margins", out var value) || !Closed(value, here, "top", "right", "bottom", "left")) return null!;
    return new PageMargins(Margin(value, here, "top"), Margin(value, here, "right"), Margin(value, here, "bottom"), Margin(value, here, "left"));
  }

  private double Margin(JsonElement parent, string at, string name)
  {
    if (!Field(parent, at, name, out var value)) return 0;
    var here = $"{at}/{name}";
    if (value.ValueKind != JsonValueKind.Number) { Add(here, "type"); return 0; }
    var margin = value.GetDouble();
    if (margin < 10) Add(here, "minimum");
    else if (margin > 50) Add(here, "maximum");
    else if (margin * 2 != Math.Floor(margin * 2)) Add(here, "multiple_of");
    return margin;
  }

  private string? BodyFont(JsonElement parent, string at)
  {
    if (!Field(parent, at, "bodyFont", out var value) || value.ValueKind == JsonValueKind.Null) return null;
    var here = $"{at}/bodyFont";
    if (value.ValueKind != JsonValueKind.String) { Add(here, "type"); return null; }
    var font = value.GetString()!;
    if (font.Length is < 1 or > 40 || !font.All(c => c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-')) Add(here, "pattern");
    return font;
  }

  private ResumeHeader Header(JsonElement parent, string at)
  {
    var here = $"{at}/header";
    if (!Field(parent, at, "header", out var value) || !Closed(value, here, "fullName", "headline", "showPhoto", "contacts")) return null!;
    return new ResumeHeader(
      Text(value, here, "fullName", 0, ResumeLimits.FullName),
      Text(value, here, "headline", 0, ResumeLimits.Headline),
      Flag(value, here, "showPhoto"),
      [.. Items(value, here, "contacts", 0, ResumeLimits.Contacts).Select(item => Contact(item.Value, item.At))]);
  }

  private ContactItem Contact(JsonElement value, string at)
  {
    if (!Closed(value, at, "id", "text", "url", "kind")) return null!;
    return new ContactItem(Uuid(value, at, "id"), Text(value, at, "text", 0, ResumeLimits.ContactText), NullableUrl(value, at, "url"), Choice(value, at, "kind", ContactKinds));
  }

  private ResumeSection Section(JsonElement value, string at)
  {
    if (!Closed(value, at, "id", "type", "title", "hidden", "listColumns", "placement", "content")) return null!;
    var type = Choice(value, at, "type", SectionTypes);
    var id = Uuid(value, at, "id");
    var title = Text(value, at, "title", 0, ResumeLimits.SectionTitle);
    var hidden = Flag(value, at, "hidden");
    var columns = ListColumns(value, at);
    var placement = NullableChoice(value, at, "placement", Placements);
    if (!Field(value, at, "content", out var content)) return null!;
    var here = $"{at}/content";
    switch (type)
    {
      case "text":
        if (!Closed(content, here, "body")) return null!;
        return new TextSection(id, title, hidden, columns, placement, RichText(content, here, "body"));
      case "inline":
        if (!Closed(content, here, "body")) return null!;
        var paragraphs = Items(content, here, "body", 1, 1).Select(item => Paragraph(item.Value, item.At, true)).ToArray();
        return new InlineSection(id, title, hidden, columns, placement, paragraphs.FirstOrDefault()!);
      case "list":
        if (!Closed(content, here, "items")) return null!;
        return new ListSection(id, title, hidden, columns, placement, [.. Items(content, here, "items", 0, ResumeLimits.ListItems).Select(item => ListItem(item.Value, item.At))]);
      case "entries":
        if (!Closed(content, here, "labels", "entries")) return null!;
        return new EntriesSection(id, title, hidden, columns, placement, Labels(content, here), [.. Items(content, here, "entries", 0, ResumeLimits.Entries).Select(item => Entry(item.Value, item.At))]);
      default:
        return null!;
    }
  }

  private int? ListColumns(JsonElement parent, string at)
  {
    if (!Field(parent, at, "listColumns", out var value) || value.ValueKind == JsonValueKind.Null) return null;
    if (!IsInteger(value, out var number)) { Add($"{at}/listColumns", "type"); return null; }
    if (number is 1 or 2) return (int)number;
    Add($"{at}/listColumns", "enum");
    return null;
  }

  private ResumeListItem ListItem(JsonElement value, string at)
  {
    if (!Closed(value, at, "id", "text")) return null!;
    return new ResumeListItem(Uuid(value, at, "id"), Inlines(value, at, "text"));
  }

  private EntryLabels? Labels(JsonElement parent, string at)
  {
    if (!Field(parent, at, "labels", out var value) || value.ValueKind == JsonValueKind.Null) return null;
    var here = $"{at}/labels";
    if (!Closed(value, here, "title", "organization", "location")) return null;
    return new EntryLabels(NullableText(value, here, "title", 1, ResumeLimits.Label), NullableText(value, here, "organization", 1, ResumeLimits.Label), NullableText(value, here, "location", 1, ResumeLimits.Label));
  }

  private ResumeEntry Entry(JsonElement value, string at)
  {
    if (!Closed(value, at, "id", "title", "organization", "location", "start", "end", "dateText", "description", "pageBreakBefore")) return null!;
    return new ResumeEntry(
      Uuid(value, at, "id"),
      Text(value, at, "title", 0, ResumeLimits.EntryField),
      Text(value, at, "organization", 0, ResumeLimits.EntryField),
      Text(value, at, "location", 0, ResumeLimits.EntryField),
      Start(value, at),
      End(value, at),
      Text(value, at, "dateText", 0, ResumeLimits.DateText),
      RichText(value, at, "description"),
      Flag(value, at, "pageBreakBefore"));
  }

  private PartialDate? Start(JsonElement parent, string at)
  {
    if (!Field(parent, at, "start", out var value) || value.ValueKind == JsonValueKind.Null) return null;
    return Date(value, $"{at}/start");
  }

  private EndDate? End(JsonElement parent, string at)
  {
    if (!Field(parent, at, "end", out var value) || value.ValueKind == JsonValueKind.Null) return null;
    var here = $"{at}/end";
    if (value.ValueKind != JsonValueKind.Object) { Add(here, "type"); return null; }
    if (Choice(value, here, "kind", EndKinds) != "present") return Date(value, here);
    Closed(value, here, "kind");
    return new PresentDate();
  }

  private PartialDate Date(JsonElement value, string at)
  {
    if (!Closed(value, at, "kind", "year", "month")) return null!;
    Const(value, at, "kind", "date");
    var year = Int(value, at, "year", 1900, 2100);
    if (!Field(value, at, "month", out var month) || month.ValueKind == JsonValueKind.Null) return new PartialDate(year, null);
    return new PartialDate(year, Int(value, at, "month", 1, 12));
  }

  private List<RichBlock> RichText(JsonElement parent, string at, string name) =>
    [.. Items(parent, at, name, 0, int.MaxValue).Select(item => Block(item.Value, item.At))];

  private RichBlock Block(JsonElement value, string at)
  {
    if (value.ValueKind != JsonValueKind.Object) { Add(at, "type"); return null!; }
    switch (Choice(value, at, "kind", BlockKinds))
    {
      case "paragraph":
        return Paragraph(value, at, false);
      case "bulletList":
        if (!Closed(value, at, "kind", "items")) return null!;
        return new BulletListBlock([.. Items(value, at, "items", 1, int.MaxValue).Select(item => (IReadOnlyList<RichInline>)InlineArray(item.Value, item.At))]);
      default:
        return null!;
    }
  }

  private ParagraphBlock Paragraph(JsonElement value, string at, bool checkKind)
  {
    if (!Closed(value, at, "kind", "inlines")) return null!;
    if (checkKind) Const(value, at, "kind", "paragraph");
    return new ParagraphBlock(Inlines(value, at, "inlines"));
  }

  private List<RichInline> Inlines(JsonElement parent, string at, string name) =>
    Field(parent, at, name, out var value) ? InlineArray(value, $"{at}/{name}") : [];

  private List<RichInline> InlineArray(JsonElement value, string at)
  {
    if (value.ValueKind != JsonValueKind.Array) { Add(at, "type"); return []; }
    var inlines = new List<RichInline>();
    var index = 0;
    foreach (var item in value.EnumerateArray()) inlines.Add(Inline(item, $"{at}/{index++}"));
    return inlines;
  }

  private RichInline Inline(JsonElement value, string at)
  {
    if (value.ValueKind != JsonValueKind.Object) { Add(at, "type"); return null!; }
    switch (Choice(value, at, "kind", InlineKinds))
    {
      case "text":
        return Run(value, at);
      case "link":
        if (!Closed(value, at, "kind", "url", "children")) return null!;
        return new LinkInline(Url(value, at, "url"), [.. Items(value, at, "children", 1, int.MaxValue).Select(item => ChildRun(item.Value, item.At))]);
      case "lineBreak":
        Closed(value, at, "kind");
        return new LineBreakInline();
      default:
        return null!;
    }
  }

  private TextRun ChildRun(JsonElement value, string at)
  {
    if (value.ValueKind != JsonValueKind.Object) { Add(at, "type"); return null!; }
    Const(value, at, "kind", "text");
    return Run(value, at);
  }

  private TextRun Run(JsonElement value, string at)
  {
    if (!Closed(value, at, "kind", "value", "bold", "italic", "underline")) return null!;
    return new TextRun(Text(value, at, "value", 1, ResumeLimits.TotalText), Flag(value, at, "bold"), Flag(value, at, "italic"), Flag(value, at, "underline"));
  }

  // ---------------------------------------------------------------- primitives

  /// <summary>Unknown properties report the parent pointer, so a submitted key name is never echoed (DD-P07-08).</summary>
  public bool Closed(JsonElement value, string at, params string[] names)
  {
    if (value.ValueKind != JsonValueKind.Object) { Add(at, "type"); return false; }
    foreach (var property in value.EnumerateObject())
    {
      if (Array.IndexOf(names, property.Name) >= 0) continue;
      Add(at, "unknown_property");
      break;
    }
    return true;
  }

  public bool Field(JsonElement parent, string at, string name, out JsonElement value)
  {
    if (parent.TryGetProperty(name, out value)) return true;
    Add($"{at}/{name}", "required");
    return false;
  }

  public string Text(JsonElement parent, string at, string name, int minimum, int maximum)
  {
    if (!Field(parent, at, name, out var value)) return "";
    if (value.ValueKind != JsonValueKind.String) { Add($"{at}/{name}", "type"); return ""; }
    return Bounded(value, $"{at}/{name}", minimum, maximum);
  }

  public string? NullableText(JsonElement parent, string at, string name, int minimum, int maximum)
  {
    if (!Field(parent, at, name, out var value) || value.ValueKind == JsonValueKind.Null) return null;
    if (value.ValueKind != JsonValueKind.String) { Add($"{at}/{name}", "type"); return null; }
    return Bounded(value, $"{at}/{name}", minimum, maximum);
  }

  private string Bounded(JsonElement value, string at, int minimum, int maximum)
  {
    var text = value.GetString()!;
    var length = ResumeDocumentRules.CodePoints(text);
    if (length < minimum) Add(at, "min_length");
    else if (length > maximum) Add(at, "max_length");
    return text;
  }

  public void Const(JsonElement parent, string at, string name, string expected)
  {
    if (!Field(parent, at, name, out var value)) return;
    if (value.ValueKind != JsonValueKind.String) Add($"{at}/{name}", "type");
    else if (!value.ValueEquals(expected)) Add($"{at}/{name}", "const");
  }

  private string Choice(JsonElement parent, string at, string name, string[] allowed)
  {
    if (!Field(parent, at, name, out var value)) return "";
    if (value.ValueKind != JsonValueKind.String) { Add($"{at}/{name}", "type"); return ""; }
    var text = value.GetString()!;
    if (Array.IndexOf(allowed, text) >= 0) return text;
    Add($"{at}/{name}", "enum");
    return "";
  }

  private string? NullableChoice(JsonElement parent, string at, string name, string[] allowed)
  {
    if (!Field(parent, at, name, out var value) || value.ValueKind == JsonValueKind.Null) return null;
    return Choice(parent, at, name, allowed);
  }

  public int Int(JsonElement parent, string at, string name, int minimum, int maximum)
  {
    if (!Field(parent, at, name, out var value)) return 0;
    if (!IsInteger(value, out var number)) { Add($"{at}/{name}", "type"); return 0; }
    if (number < minimum) { Add($"{at}/{name}", "minimum"); return 0; }
    if (number > maximum) { Add($"{at}/{name}", "maximum"); return 0; }
    return (int)number;
  }

  /// <summary>JSON Schema `integer` accepts 1.0. A number that does not fit a decimal is out of every range here.</summary>
  private static bool IsInteger(JsonElement value, out decimal number)
  {
    number = 0;
    return value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out number) && number == Math.Truncate(number);
  }

  private bool Flag(JsonElement parent, string at, string name)
  {
    if (!Field(parent, at, name, out var value)) return false;
    if (value.ValueKind is JsonValueKind.True or JsonValueKind.False) return value.GetBoolean();
    Add($"{at}/{name}", "type");
    return false;
  }

  public string Uuid(JsonElement parent, string at, string name)
  {
    if (!Field(parent, at, name, out var value)) return "";
    if (value.ValueKind != JsonValueKind.String) { Add($"{at}/{name}", "type"); return ""; }
    var text = value.GetString()!;
    if (!Guid.TryParseExact(text, "D", out _)) Add($"{at}/{name}", "format");
    return text;
  }

  private string Url(JsonElement parent, string at, string name) =>
    Field(parent, at, name, out var value) ? UrlValue(value, $"{at}/{name}") : "";

  private string? NullableUrl(JsonElement parent, string at, string name)
  {
    if (!Field(parent, at, name, out var value) || value.ValueKind == JsonValueKind.Null) return null;
    return UrlValue(value, $"{at}/{name}");
  }

  private string UrlValue(JsonElement value, string at)
  {
    if (value.ValueKind != JsonValueKind.String) { Add(at, "type"); return ""; }
    var url = value.GetString()!;
    if (ResumeDocumentRules.CodePoints(url) > ResumeLimits.Url) Add(at, "max_length");
    else if (!SafeUrl.IsValid(url)) Add(at, "pattern");
    return url;
  }

  private IEnumerable<(JsonElement Value, string At)> Items(JsonElement parent, string at, string name, int minimum, int maximum)
  {
    if (!Field(parent, at, name, out var value)) yield break;
    var here = $"{at}/{name}";
    if (value.ValueKind != JsonValueKind.Array) { Add(here, "type"); yield break; }
    var count = value.GetArrayLength();
    if (count < minimum) Add(here, "min_items");
    else if (count > maximum) Add(here, "max_items");
    var index = 0;
    foreach (var item in value.EnumerateArray()) yield return (item, $"{here}/{index++}");
  }
}

/// <summary>The other closed request schemas of the P07 operations.</summary>
public static class ResumeRequestReader
{
  public static (CreateResumeCommand? Command, IReadOnlyList<DocumentIssue> Issues) ReadCreate(JsonElement value)
  {
    var reader = new ClosedSchemaReader();
    CreateResumeCommand? command = null;
    if (value.ValueKind != JsonValueKind.Object) reader.Add("", "type");
    else if (!value.TryGetProperty("source", out var source)) reader.Add("/source", "required");
    else if (source.ValueKind != JsonValueKind.String) reader.Add("/source", "type");
    else if (source.ValueEquals("document"))
    {
      reader.Closed(value, "", "source", "document", "copyPhotoFromResumeId");
      Guid? photoSource = null;
      if (reader.Field(value, "", "copyPhotoFromResumeId", out var photo) && photo.ValueKind != JsonValueKind.Null) photoSource = OptionalGuid(reader, value, "copyPhotoFromResumeId");
      var document = reader.Field(value, "", "document", out var body) ? reader.Document(body, "/document") : null;
      command = new CreateFromDocument(document!, photoSource);
    }
    else if (source.ValueEquals("copy"))
    {
      reader.Closed(value, "", "source", "sourceResumeId", "title");
      var from = OptionalGuid(reader, value, "sourceResumeId");
      var title = reader.NullableText(value, "", "title", 0, ResumeLimits.Title);
      command = new CreateCopy(from ?? Guid.Empty, title);
    }
    else reader.Add("/source", "enum");
    return reader.Issues.Count == 0 ? (command, []) : (null, reader.Issues);
  }

  public static IReadOnlyList<DocumentIssue> ReadSnapshot(JsonElement value)
  {
    var reader = new ClosedSchemaReader();
    if (reader.Closed(value, "", "reason")) reader.Const(value, "", "reason", "before_export");
    return reader.Issues;
  }

  public static (PhotoCrop? Crop, IReadOnlyList<DocumentIssue> Issues) ReadCrop(JsonElement value)
  {
    var reader = new ClosedSchemaReader();
    if (!reader.Closed(value, "", "x", "y", "width", "height")) return (null, reader.Issues);
    var crop = new PhotoCrop(
      reader.Int(value, "", "x", 0, ResumeLimits.MaxPhotoSide - 1),
      reader.Int(value, "", "y", 0, ResumeLimits.MaxPhotoSide - 1),
      reader.Int(value, "", "width", 1, ResumeLimits.MaxPhotoSide),
      reader.Int(value, "", "height", 1, ResumeLimits.MaxPhotoSide));
    return reader.Issues.Count == 0 ? (crop, []) : (null, reader.Issues);
  }

  private static Guid? OptionalGuid(ClosedSchemaReader reader, JsonElement value, string name)
  {
    var text = reader.Uuid(value, "", name);
    return Guid.TryParseExact(text, "D", out var id) ? id : null;
  }
}
