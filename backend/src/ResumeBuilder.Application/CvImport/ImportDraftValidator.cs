using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ResumeBuilder.Application.CvImport;

/// <summary>`Draft` is null when the model's output is not an `ImportDraft` (contract schema).</summary>
public sealed record DraftCheck(JsonObject? Draft, IReadOnlyList<ImportWarning> Warnings, int NotInSource);

/// <summary>
/// ADR-055 §5: the contract schema, then the verbatim check, then the document limits. With `drop` the strings
/// that fail the verbatim check are removed (DD-IMP-08); without it they are only counted. Limits always apply.
/// </summary>
public static partial class ImportDraftValidator
{
  private static readonly HashSet<string> Kinds = ["email", "phone", "location", "link", "other"];
  private static readonly HashSet<string> Languages = ["en", "es", "uk"];
  private static readonly HashSet<string> SectionTypes = ["text", "list", "entries"];
  private static readonly HashSet<string> Placements = ["main", "sidebar"];
  private static readonly HashSet<string> BlockKinds = ["paragraph", "bullet"];

  public static DraftCheck Check(string json, VerbatimSource source, bool drop)
  {
    ArgumentNullException.ThrowIfNull(source);
    JsonNode? node;
    try { node = JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { MaxDepth = 16 }); }
    catch (JsonException) { return new DraftCheck(null, [], 0); }
    if (node is not JsonObject draft || !IsDraft(draft)) return new DraftCheck(null, [], 0);
    var walker = new Walker(source, drop);
    walker.Run(draft);
    // The contract caps `warnings` at 500: a draft with thousands of surplus items reports the first 500 changes.
    return new DraftCheck(draft, walker.Warnings.Take(MaxWarnings).ToArray(), walker.NotInSource);
  }

  public const int MaxWarnings = 500;

  // ---------------------------------------------------------------- the contract's ImportDraft schema

  private static bool Exactly(JsonNode? node, params string[] names) =>
    node is JsonObject item && item.Count == names.Length && names.All(item.ContainsKey);
  private static bool IsString(JsonNode? node) => node is JsonValue value && value.GetValueKind() == JsonValueKind.String;
  private static bool IsStringOrNull(JsonNode? node) => node is null || IsString(node);
  private static bool IsBoolean(JsonNode? node) => node is JsonValue value && value.GetValueKind() is JsonValueKind.True or JsonValueKind.False;
  private static bool IsEnum(JsonNode? node, HashSet<string> values) => IsString(node) && values.Contains(node!.GetValue<string>());
  private static bool IsInteger(JsonNode? node, int min, int max) => node is JsonValue value && value.TryGetValue<int>(out var number) && number >= min && number <= max;
  private static bool IsArray(JsonNode? node, Func<JsonNode?, bool> item) => node is JsonArray list && list.All(item);

  private static bool IsDraft(JsonObject draft) =>
    Exactly(draft, "fullName", "headline", "contacts", "language", "sections")
    && IsString(draft["fullName"]) && IsStringOrNull(draft["headline"])
    && IsArray(draft["contacts"], contact => Exactly(contact, "text", "kind") && IsString(contact!["text"]) && IsEnum(contact["kind"], Kinds))
    && (draft["language"] is null || IsEnum(draft["language"], Languages))
    && IsArray(draft["sections"], IsSection);

  private static bool IsSection(JsonNode? section) =>
    Exactly(section, "title", "type", "placement", "blocks", "items", "entries")
    && IsString(section!["title"]) && IsEnum(section["type"], SectionTypes) && IsEnum(section["placement"], Placements)
    && IsArray(section["blocks"], IsBlock) && IsArray(section["items"], IsString) && IsArray(section["entries"], IsEntry);

  private static bool IsBlock(JsonNode? block) => Exactly(block, "kind", "text") && IsEnum(block!["kind"], BlockKinds) && IsString(block["text"]);

  private static bool IsDate(JsonNode? date) =>
    date is null || (Exactly(date, "year", "month") && IsInteger(date["year"], 1900, 2100) && (date["month"] is null || IsInteger(date["month"], 1, 12)));

  private static bool IsEntry(JsonNode? entry) =>
    Exactly(entry, "title", "organization", "location", "start", "end", "present", "dateText", "blocks")
    && IsStringOrNull(entry!["title"]) && IsStringOrNull(entry["organization"]) && IsStringOrNull(entry["location"])
    && IsDate(entry["start"]) && IsDate(entry["end"]) && IsBoolean(entry["present"]) && IsStringOrNull(entry["dateText"])
    && IsArray(entry["blocks"], IsBlock);

  // ---------------------------------------------------------------- verbatim check and limits

  private sealed class Walker(VerbatimSource source, bool drop)
  {
    public List<ImportWarning> Warnings { get; } = [];
    public int NotInSource { get; private set; }

    public void Run(JsonObject draft)
    {
      Text(draft, "fullName", "/fullName", 120, Missing.Empty);
      Text(draft, "headline", "/headline", 200, Missing.Null);
      Items(draft["contacts"]!.AsArray(), "/contacts", 20, (contact, at) => Keep(contact!.AsObject(), "text", $"{at}/text", 200));
      Items(draft["sections"]!.AsArray(), "/sections", 100, (section, at) => { Section(section!.AsObject(), at); return true; });
    }

    private void Section(JsonObject section, string at)
    {
      Text(section, "title", $"{at}/title", 80, Missing.Empty, ignoreCase: true);
      Blocks(section["blocks"]!.AsArray(), $"{at}/blocks");
      Items(section["items"]!.AsArray(), $"{at}/items", 100, (item, path) => KeepValue(item!, path, 2000));
      Items(section["entries"]!.AsArray(), $"{at}/entries", 100, (entry, path) => { Entry(entry!.AsObject(), path); return true; });
    }

    private void Entry(JsonObject entry, string at)
    {
      foreach (var name in new[] { "title", "organization", "location" }) Text(entry, name, $"{at}/{name}", 150, Missing.Null);
      Date(entry, "start", $"{at}/start");
      Date(entry, "end", $"{at}/end");
      Text(entry, "dateText", $"{at}/dateText", 60, Missing.Null);
      Blocks(entry["blocks"]!.AsArray(), $"{at}/blocks");
    }

    private void Blocks(JsonArray blocks, string at) => Items(blocks, at, 200, (block, path) => Keep(block!.AsObject(), "text", $"{path}/text", 10000));

    /// <summary>Checks each item within the limit (an item whose check returns false is removed), then drops the surplus.</summary>
    private void Items(JsonArray items, string at, int limit, Func<JsonNode?, string, bool> keep)
    {
      var removed = new List<int>();
      for (var index = 0; index < Math.Min(items.Count, limit); index++)
        if (!keep(items[index], $"{at}/{index}")) removed.Add(index);
      for (var index = limit; index < items.Count; index++) Warnings.Add(new ImportWarning("over_limit", $"{at}/{index}"));
      while (items.Count > limit) items.RemoveAt(items.Count - 1);
      for (var index = removed.Count - 1; index >= 0; index--) items.RemoveAt(removed[index]);
    }

    private enum Missing { Empty, Null }

    private void Text(JsonObject owner, string name, string at, int limit, Missing missing, bool ignoreCase = false)
    {
      if (owner[name] is not JsonValue node) return;
      var value = node.GetValue<string>();
      if (!Verbatim(value, ignoreCase, at)) { if (drop) owner[name] = missing == Missing.Empty ? "" : null; return; }
      if (Clamp(value, limit) is { } clamped) { owner[name] = clamped; Warnings.Add(new ImportWarning("clamped", at)); }
    }

    /// <summary>A string inside an object whose removal removes the object (a contact, a block).</summary>
    private bool Keep(JsonObject owner, string name, string at, int limit)
    {
      var value = owner[name]!.GetValue<string>();
      if (!Verbatim(value, false, at)) return !drop;
      if (Clamp(value, limit) is { } clamped) { owner[name] = clamped; Warnings.Add(new ImportWarning("clamped", at)); }
      return true;
    }

    private bool KeepValue(JsonNode item, string at, int limit)
    {
      var value = item.GetValue<string>();
      if (!Verbatim(value, false, at)) return !drop;
      if (Clamp(value, limit) is { } clamped) { item.ReplaceWith(JsonValue.Create(clamped)); Warnings.Add(new ImportWarning("clamped", at)); }
      return true;
    }

    private void Date(JsonObject entry, string name, string at)
    {
      if (entry[name] is not JsonObject date) return;
      var month = date["month"] is null ? (int?)null : date["month"]!.GetValue<int>();
      if (source.HasDate(date["year"]!.GetValue<int>(), month)) return;
      NotInSource++;
      Warnings.Add(new ImportWarning("not_in_source", at));
      if (drop) entry[name] = null;
    }

    private bool Verbatim(string value, bool ignoreCase, string at)
    {
      if (source.HasText(value, ignoreCase) && Hrefs(value).All(source.HasHref)) return true;
      NotInSource++;
      Warnings.Add(new ImportWarning("not_in_source", at));
      return false;
    }

    private static IEnumerable<string> Hrefs(string value) => Href().Matches(value).Select(match => match.Groups[1].Value);

    /// <summary>The value cut to `limit` code points, or null when it fits.</summary>
    private static string? Clamp(string value, int limit)
    {
      var runes = value.EnumerateRunes().ToArray();
      if (runes.Length <= limit) return null;
      var builder = new StringBuilder();
      foreach (var rune in runes.AsSpan(0, limit)) builder.Append(rune.ToString());
      return builder.ToString();
    }
  }

  [GeneratedRegex("<a href=\"([^\"]*)\">", RegexOptions.CultureInvariant)]
  private static partial Regex Href();
}
