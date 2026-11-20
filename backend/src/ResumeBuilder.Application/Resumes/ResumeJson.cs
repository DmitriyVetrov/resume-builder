using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Application.Resumes;

public static class ResumeDocumentWriter
{
  public static void Write(Utf8JsonWriter writer, ResumeDocument document)
  {
    ArgumentNullException.ThrowIfNull(writer);
    ArgumentNullException.ThrowIfNull(document);
    writer.WriteStartObject();
    writer.WriteString("title", document.Title);
    writer.WriteString("templateId", document.TemplateId);
    writer.WriteNumber("accentPreset", document.AccentPreset);
    writer.WriteString("language", document.Language);
    writer.WriteString("dateFormat", document.DateFormat);
    writer.WriteStartObject("layout");
    writer.WriteString("fontPreset", document.Layout.FontPreset);
    writer.WriteNumber("sectionSpacing", document.Layout.SectionSpacing);
    writer.WriteNumber("entrySpacing", document.Layout.EntrySpacing);
    writer.WriteNumber("lineSpacing", document.Layout.LineSpacing);
    writer.WriteString("pageSize", document.Layout.PageSize);
    writer.WriteStartObject("margins");
    writer.WriteNumber("top", document.Layout.Margins.Top);
    writer.WriteNumber("right", document.Layout.Margins.Right);
    writer.WriteNumber("bottom", document.Layout.Margins.Bottom);
    writer.WriteNumber("left", document.Layout.Margins.Left);
    writer.WriteEndObject();
    writer.WriteString("bodyFont", document.Layout.BodyFont);
    writer.WriteEndObject();
    writer.WriteStartObject("header");
    writer.WriteString("fullName", document.Header.FullName);
    writer.WriteString("headline", document.Header.Headline);
    writer.WriteBoolean("showPhoto", document.Header.ShowPhoto);
    writer.WriteStartArray("contacts");
    foreach (var contact in document.Header.Contacts)
    {
      writer.WriteStartObject();
      writer.WriteString("id", contact.Id);
      writer.WriteString("text", contact.Text);
      writer.WriteString("url", contact.Url);
      writer.WriteString("kind", contact.Kind);
      writer.WriteEndObject();
    }
    writer.WriteEndArray();
    writer.WriteEndObject();
    writer.WriteStartArray("sections");
    foreach (var section in document.Sections) Section(writer, section);
    writer.WriteEndArray();
    writer.WriteEndObject();
  }

  public static string ToJson(ResumeDocument document) => Encoding.UTF8.GetString(ResumeRepresentation.Json(writer => Write(writer, document)));

  private static void Section(Utf8JsonWriter writer, ResumeSection section)
  {
    writer.WriteStartObject();
    writer.WriteString("id", section.Id);
    writer.WriteString("type", section switch { TextSection => "text", InlineSection => "inline", ListSection => "list", _ => "entries" });
    writer.WriteString("title", section.Title);
    writer.WriteBoolean("hidden", section.Hidden);
    if (section.ListColumns is int columns) writer.WriteNumber("listColumns", columns);
    else writer.WriteNull("listColumns");
    writer.WriteString("placement", section.Placement);
    writer.WriteStartObject("content");
    switch (section)
    {
      case TextSection text:
        writer.WritePropertyName("body");
        Blocks(writer, text.Body);
        break;
      case InlineSection inline:
        writer.WritePropertyName("body");
        Blocks(writer, [inline.Body]);
        break;
      case ListSection list:
        writer.WriteStartArray("items");
        foreach (var item in list.Items)
        {
          writer.WriteStartObject();
          writer.WriteString("id", item.Id);
          writer.WritePropertyName("text");
          Inlines(writer, item.Text);
          writer.WriteEndObject();
        }
        writer.WriteEndArray();
        break;
      case EntriesSection entries:
        if (entries.Labels is { } labels)
        {
          writer.WriteStartObject("labels");
          writer.WriteString("title", labels.Title);
          writer.WriteString("organization", labels.Organization);
          writer.WriteString("location", labels.Location);
          writer.WriteEndObject();
        }
        else writer.WriteNull("labels");
        writer.WriteStartArray("entries");
        foreach (var entry in entries.Entries) Entry(writer, entry);
        writer.WriteEndArray();
        break;
    }
    writer.WriteEndObject();
    writer.WriteEndObject();
  }

  private static void Entry(Utf8JsonWriter writer, ResumeEntry entry)
  {
    writer.WriteStartObject();
    writer.WriteString("id", entry.Id);
    writer.WriteString("title", entry.Title);
    writer.WriteString("organization", entry.Organization);
    writer.WriteString("location", entry.Location);
    writer.WritePropertyName("start");
    Date(writer, entry.Start);
    writer.WritePropertyName("end");
    Date(writer, entry.End);
    writer.WriteString("dateText", entry.DateText);
    writer.WritePropertyName("description");
    Blocks(writer, entry.Description);
    writer.WriteBoolean("pageBreakBefore", entry.PageBreakBefore);
    writer.WriteEndObject();
  }

  private static void Date(Utf8JsonWriter writer, EndDate? date)
  {
    switch (date)
    {
      case null:
        writer.WriteNullValue();
        break;
      case PartialDate partial:
        writer.WriteStartObject();
        writer.WriteString("kind", "date");
        writer.WriteNumber("year", partial.Year);
        if (partial.Month is int month) writer.WriteNumber("month", month);
        else writer.WriteNull("month");
        writer.WriteEndObject();
        break;
      default:
        writer.WriteStartObject();
        writer.WriteString("kind", "present");
        writer.WriteEndObject();
        break;
    }
  }

  private static void Blocks(Utf8JsonWriter writer, IReadOnlyList<RichBlock> blocks)
  {
    writer.WriteStartArray();
    foreach (var block in blocks)
    {
      writer.WriteStartObject();
      if (block is ParagraphBlock paragraph)
      {
        writer.WriteString("kind", "paragraph");
        writer.WritePropertyName("inlines");
        Inlines(writer, paragraph.Inlines);
      }
      else if (block is BulletListBlock bullets)
      {
        writer.WriteString("kind", "bulletList");
        writer.WriteStartArray("items");
        foreach (var item in bullets.Items) Inlines(writer, item);
        writer.WriteEndArray();
      }
      writer.WriteEndObject();
    }
    writer.WriteEndArray();
  }

  private static void Inlines(Utf8JsonWriter writer, IReadOnlyList<RichInline> inlines)
  {
    writer.WriteStartArray();
    foreach (var inline in inlines)
    {
      switch (inline)
      {
        case TextRun run:
          Run(writer, run);
          break;
        case LinkInline link:
          writer.WriteStartObject();
          writer.WriteString("kind", "link");
          writer.WriteString("url", link.Url);
          writer.WriteStartArray("children");
          foreach (var child in link.Children) Run(writer, child);
          writer.WriteEndArray();
          writer.WriteEndObject();
          break;
        default:
          writer.WriteStartObject();
          writer.WriteString("kind", "lineBreak");
          writer.WriteEndObject();
          break;
      }
    }
    writer.WriteEndArray();
  }

  private static void Run(Utf8JsonWriter writer, TextRun run)
  {
    writer.WriteStartObject();
    writer.WriteString("kind", "text");
    writer.WriteString("value", run.Value);
    writer.WriteBoolean("bold", run.Bold);
    writer.WriteBoolean("italic", run.Italic);
    writer.WriteBoolean("underline", run.Underline);
    writer.WriteEndObject();
  }
}

/// <summary>RFC 8785 canonical JSON.</summary>
public static class CanonicalJson
{
  public static byte[] Serialize(JsonElement element)
  {
    var output = new StringBuilder();
    Write(output, element);
    return Encoding.UTF8.GetBytes(output.ToString());
  }

  private static void Write(StringBuilder output, JsonElement element)
  {
    switch (element.ValueKind)
    {
      case JsonValueKind.Object:
        output.Append('{');
        var first = true;
        foreach (var property in element.EnumerateObject().OrderBy(property => property.Name, StringComparer.Ordinal))
        {
          if (!first) output.Append(',');
          first = false;
          String(output, property.Name);
          output.Append(':');
          Write(output, property.Value);
        }
        output.Append('}');
        break;
      case JsonValueKind.Array:
        output.Append('[');
        var firstItem = true;
        foreach (var item in element.EnumerateArray())
        {
          if (!firstItem) output.Append(',');
          firstItem = false;
          Write(output, item);
        }
        output.Append(']');
        break;
      case JsonValueKind.String:
        String(output, element.GetString()!);
        break;
      case JsonValueKind.Number:
        output.Append(Number(element.GetDouble()));
        break;
      case JsonValueKind.True:
        output.Append("true");
        break;
      case JsonValueKind.False:
        output.Append("false");
        break;
      default:
        output.Append("null");
        break;
    }
  }

  private static void String(StringBuilder output, string value)
  {
    output.Append('"');
    foreach (var c in value)
    {
      switch (c)
      {
        case '"': output.Append("\\\""); break;
        case '\\': output.Append("\\\\"); break;
        case '\b': output.Append("\\b"); break;
        case '\f': output.Append("\\f"); break;
        case '\n': output.Append("\\n"); break;
        case '\r': output.Append("\\r"); break;
        case '\t': output.Append("\\t"); break;
        default:
          if (c < 0x20) output.Append(CultureInfo.InvariantCulture, $"\\u{(int)c:x4}");
          else output.Append(c);
          break;
      }
    }
    output.Append('"');
  }

  /// <summary>ECMAScript `Number.prototype.toString`, from the shortest round-trip digits .NET already computes.</summary>
  private static string Number(double value)
  {
    if (value == 0) return "0";
    var shortest = Math.Abs(value).ToString("R", CultureInfo.InvariantCulture);
    var exponentAt = shortest.IndexOf('E', StringComparison.Ordinal);
    var exponent = exponentAt < 0 ? 0 : int.Parse(shortest[(exponentAt + 1)..], NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture);
    var mantissa = exponentAt < 0 ? shortest : shortest[..exponentAt];
    var pointAt = mantissa.IndexOf('.', StringComparison.Ordinal);
    var integerLength = pointAt < 0 ? mantissa.Length : pointAt;
    var raw = mantissa.Replace(".", "", StringComparison.Ordinal);
    var leadingZeros = raw.Length - raw.TrimStart('0').Length;
    var digits = raw.Trim('0');
    var k = digits.Length;
    var n = integerLength + exponent - leadingZeros;
    string text;
    if (k <= n && n <= 21) text = digits + new string('0', n - k);
    else if (n is > 0 and <= 21) text = $"{digits[..n]}.{digits[n..]}";
    else if (n is > -6 and <= 0) text = $"0.{new string('0', -n)}{digits}";
    else
    {
      var e = n - 1;
      var sign = e < 0 ? '-' : '+';
      var power = Math.Abs(e).ToString(CultureInfo.InvariantCulture);
      text = k == 1 ? $"{digits}e{sign}{power}" : $"{digits[0]}.{digits[1..]}e{sign}{power}";
    }
    return value < 0 ? "-" + text : text;
  }
}

/// <summary>The contract's `Idempotency-Key` request hash: SHA-256 of `METHOD path\n` followed by the body digest input.</summary>
public static class RequestHash
{
  public static string Compute(string method, string path, ReadOnlySpan<byte> bodyInput)
  {
    using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    hash.AppendData(Encoding.UTF8.GetBytes($"{method} {path}\n"));
    hash.AppendData(bodyInput);
    return Convert.ToHexStringLower(hash.GetHashAndReset());
  }
}

/// <summary>DD-P07-19: an opaque cursor bound by hash to owner, query and resume, so a foreign one fails decoding.</summary>
public static class PageCursor
{
  private const int TagBytes = 16;
  private const int Length = TagBytes + sizeof(long) + 16;

  public static string Encode(Guid ownerId, string query, long sortMillis, Guid id)
  {
    Span<byte> bytes = stackalloc byte[Length];
    Tag(ownerId, query, id).CopyTo(bytes);
    BitConverter.TryWriteBytes(bytes[TagBytes..], sortMillis);
    id.TryWriteBytes(bytes[(TagBytes + sizeof(long))..]);
    return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
  }

  public static ListPosition? Decode(string cursor, Guid ownerId, string query)
  {
    ArgumentNullException.ThrowIfNull(cursor);
    var text = cursor.Replace('-', '+').Replace('_', '/');
    text = text.PadRight(text.Length + ((4 - (text.Length % 4)) % 4), '=');
    var bytes = new byte[Length + 3];
    if (!Convert.TryFromBase64String(text, bytes, out var written) || written != Length) return null;
    var id = new Guid(bytes.AsSpan(TagBytes + sizeof(long), 16));
    if (!CryptographicOperations.FixedTimeEquals(bytes.AsSpan(0, TagBytes), Tag(ownerId, query, id))) return null;
    return new ListPosition(BitConverter.ToInt64(bytes, TagBytes), id);
  }

  private static byte[] Tag(Guid ownerId, string query, Guid id) =>
    SHA256.HashData(Encoding.UTF8.GetBytes($"{ownerId}|{query}|{id}"))[..TagBytes];
}

/// <summary>The contract's response schemas, written by hand so no field can appear by accident (ownerId, lastWrite and so on).</summary>
public static class ResumeRepresentation
{
  private static readonly JsonWriterOptions Options = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

  public static string Stamp(DateTimeOffset value) => value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

  public static byte[] Json(Action<Utf8JsonWriter> write)
  {
    ArgumentNullException.ThrowIfNull(write);
    using var stream = new MemoryStream();
    using (var writer = new Utf8JsonWriter(stream, Options)) write(writer);
    return stream.ToArray();
  }

  public static byte[] Resume(ResumeAggregate resume) => Json(writer =>
  {
    writer.WriteStartObject();
    writer.WriteString("id", resume.Id.ToString());
    writer.WriteNumber("version", resume.Version);
    writer.WriteString("createdAt", Stamp(resume.CreatedAt));
    writer.WriteString("updatedAt", Stamp(resume.UpdatedAt));
    Nullable(writer, "deletedAt", resume.DeletedAt);
    Nullable(writer, "purgeAt", resume.PurgeAt);
    writer.WritePropertyName("photo");
    Photo(writer, resume.Photo);
    writer.WritePropertyName("document");
    ResumeDocumentWriter.Write(writer, resume.Document);
    writer.WriteEndObject();
  });

  public static byte[] State(ResumeAggregate resume) => Json(writer =>
  {
    writer.WriteStartObject();
    writer.WriteString("id", resume.Id.ToString());
    writer.WriteNumber("version", resume.Version);
    writer.WriteString("updatedAt", Stamp(resume.UpdatedAt));
    Nullable(writer, "deletedAt", resume.DeletedAt);
    Nullable(writer, "purgeAt", resume.PurgeAt);
    writer.WriteEndObject();
  });

  public static byte[] DocumentWrite(Guid id, long version, DateTimeOffset updatedAt, IReadOnlyList<DocumentWarning> warnings) => Json(writer =>
  {
    writer.WriteStartObject();
    writer.WriteString("id", id.ToString());
    writer.WriteNumber("version", version);
    writer.WriteString("updatedAt", Stamp(updatedAt));
    writer.WriteStartArray("warnings");
    foreach (var warning in warnings)
    {
      writer.WriteStartObject();
      writer.WriteString("pointer", warning.JsonPointer);
      writer.WriteString("code", warning.Code);
      writer.WriteEndObject();
    }
    writer.WriteEndArray();
    writer.WriteEndObject();
  });

  public static byte[] PhotoWrite(ResumeAggregate resume) => Json(writer =>
  {
    writer.WriteStartObject();
    writer.WriteString("id", resume.Id.ToString());
    writer.WriteNumber("version", resume.Version);
    writer.WriteString("updatedAt", Stamp(resume.UpdatedAt));
    writer.WritePropertyName("photo");
    Photo(writer, resume.Photo);
    writer.WriteEndObject();
  });

  public static byte[] ResumePage(IReadOnlyList<ResumeSummary> items, string? nextCursor) => Json(writer =>
  {
    writer.WriteStartObject();
    writer.WriteStartArray("items");
    foreach (var item in items)
    {
      writer.WriteStartObject();
      writer.WriteString("id", item.Id.ToString());
      writer.WriteNumber("version", item.Version);
      writer.WriteString("title", item.Title);
      writer.WriteString("templateId", item.TemplateId);
      writer.WriteString("createdAt", Stamp(item.CreatedAt));
      writer.WriteString("updatedAt", Stamp(item.UpdatedAt));
      Nullable(writer, "deletedAt", item.DeletedAt);
      Nullable(writer, "purgeAt", item.PurgeAt);
      writer.WriteEndObject();
    }
    writer.WriteEndArray();
    writer.WriteString("nextCursor", nextCursor);
    writer.WriteEndObject();
  });

  public static byte[] SnapshotSummary(ResumeSnapshot snapshot) => Json(writer =>
  {
    writer.WriteStartObject();
    SnapshotFields(writer, snapshot);
    writer.WriteEndObject();
  });

  public static byte[] Snapshot(ResumeSnapshot snapshot) => Json(writer =>
  {
    writer.WriteStartObject();
    SnapshotFields(writer, snapshot);
    writer.WritePropertyName("document");
    ResumeDocumentWriter.Write(writer, snapshot.Document!);
    writer.WriteEndObject();
  });

  public static byte[] SnapshotPage(IReadOnlyList<ResumeSnapshot> items, string? nextCursor) => Json(writer =>
  {
    writer.WriteStartObject();
    writer.WriteStartArray("items");
    foreach (var item in items)
    {
      writer.WriteStartObject();
      SnapshotFields(writer, item);
      writer.WriteEndObject();
    }
    writer.WriteEndArray();
    writer.WriteString("nextCursor", nextCursor);
    writer.WriteEndObject();
  });

  private static void SnapshotFields(Utf8JsonWriter writer, ResumeSnapshot snapshot)
  {
    writer.WriteString("id", snapshot.Id.ToString());
    writer.WriteString("resumeId", snapshot.ResumeId.ToString());
    writer.WriteNumber("resumeVersion", snapshot.ResumeVersion);
    writer.WriteString("reason", snapshot.Reason);
    writer.WriteString("createdAt", Stamp(snapshot.CreatedAt));
    writer.WriteString("expiresAt", Stamp(snapshot.ExpiresAt));
  }

  private static void Photo(Utf8JsonWriter writer, PhotoInfo? photo)
  {
    if (photo is null) { writer.WriteNullValue(); return; }
    writer.WriteStartObject();
    writer.WriteString("id", photo.Id.ToString());
    writer.WriteString("mime", photo.Mime);
    writer.WriteNumber("width", photo.Width);
    writer.WriteNumber("height", photo.Height);
    writer.WriteNumber("bytes", photo.Bytes);
    writer.WriteStartObject("crop");
    writer.WriteNumber("x", photo.Crop.X);
    writer.WriteNumber("y", photo.Crop.Y);
    writer.WriteNumber("width", photo.Crop.Width);
    writer.WriteNumber("height", photo.Crop.Height);
    writer.WriteEndObject();
    writer.WriteString("updatedAt", Stamp(photo.UpdatedAt));
    writer.WriteEndObject();
  }

  private static void Nullable(Utf8JsonWriter writer, string name, DateTimeOffset? value)
  {
    if (value is { } set) writer.WriteString(name, Stamp(set));
    else writer.WriteNull(name);
  }
}
