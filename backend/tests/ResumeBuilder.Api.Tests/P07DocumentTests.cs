using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Document model, reader, writer and rules, without a host. Negative reader rows are also checked against the contract schema, so the reader cannot drift from it unnoticed.</summary>
public sealed class P07DocumentTests
{
  private const string Sum = "/sections/0/content/body/0/inlines/0";

  private static DocumentRead Read(JsonNode document)
  {
    using var parsed = JsonDocument.Parse(document.ToJsonString());
    return ResumeDocumentReader.Read(parsed.RootElement);
  }

  private static IReadOnlyList<DocumentIssue> IssuesOf(JsonNode document)
  {
    var read = Read(document);
    return read.Document is null ? read.Issues : ResumeDocumentRules.Validate(read.Document);
  }

  private static JsonObject FullWithEntry(Action<JsonObject> change)
  {
    var document = P07Docs.Full();
    change(document["sections"]![2]!["content"]!["entries"]![0]!.AsObject());
    return document;
  }

  [Theory]
  [InlineData("ResumeDocumentFull", "")]
  [InlineData("ResumeExample", "document")]
  [InlineData("ResumeCreatedExample", "document")]
  [InlineData("SnapshotExample", "document")]
  [InlineData("CreateFromDocumentExample", "document")]
  [InlineData("AccountDataExportExample", "resumes")]
  public void D01EveryContractDocumentExampleRoundTripsJsonEqual(string example, string path)
  {
    var node = P07Contract.Example(example);
    var document = path switch { "" => node, "resumes" => node["resumes"]![0]!["document"]!, _ => node[path]! };
    Assert.True(P07Contract.IsValid("ResumeDocument", document.ToJsonString()), "The contract example must be valid");
    var read = Read(document);
    Assert.Empty(read.Issues);
    Assert.Empty(ResumeDocumentRules.Validate(read.Document!));
    Assert.True(P07Docs.SameJson(document.ToJsonString(), ResumeDocumentWriter.ToJson(read.Document!)));
  }

  [Fact]
  public void D03DateRangeWarningsNeverBlockAndComparePartialDatesFairly()
  {
    JsonObject At(JsonNode? start, JsonNode? end) => FullWithEntry(entry => { entry["start"] = start; entry["end"] = end; });
    static JsonObject Date(int year, int? month) => new() { ["kind"] = "date", ["year"] = year, ["month"] = month };

    var inverted = ResumeDocumentRules.Warnings(Read(At(Date(2024, 5), Date(2024, 4))).Document!);
    var warning = Assert.Single(inverted);
    Assert.Equal("/sections/2/content/entries/0/end", warning.JsonPointer);
    Assert.Equal("date_range_inverted", warning.Code);
    Assert.Empty(ResumeDocumentRules.Validate(Read(At(Date(2024, 5), Date(2024, 4))).Document!));

    Assert.Single(ResumeDocumentRules.Warnings(Read(At(Date(2025, null), Date(2024, 4))).Document!));
    Assert.Empty(ResumeDocumentRules.Warnings(Read(At(Date(2024, null), Date(2024, 4))).Document!));
    Assert.Empty(ResumeDocumentRules.Warnings(Read(At(Date(2024, 4), Date(2024, null))).Document!));
    Assert.Empty(ResumeDocumentRules.Warnings(Read(At(Date(2024, 4), Date(2024, 4))).Document!));
    Assert.Empty(ResumeDocumentRules.Warnings(Read(At(Date(2030, 1), new JsonObject { ["kind"] = "present" })).Document!));
    Assert.Empty(ResumeDocumentRules.Warnings(Read(At(null, Date(2024, 4))).Document!));
  }

  public static TheoryData<string> ReaderCases => [.. ReaderTable.Keys];

  private static readonly Dictionary<string, (Action<JsonObject> Change, string Pointer, string Code)> ReaderTable = new()
  {
    ["unknown root property"] = (d => d["ownerId"] = "x", "", "unknown_property"),
    ["unknown nested property"] = (d => d["header"]!["extra"] = 1, "/header", "unknown_property"),
    ["missing required"] = (d => d.Remove("language"), "/language", "required"),
    ["wrong type"] = (d => d["accentPreset"] = "0", "/accentPreset", "type"),
    ["null for a non-nullable"] = (d => d["header"]!["fullName"] = null, "/header/fullName", "type"),
    ["fractional integer"] = (d => d["accentPreset"] = 1.5, "/accentPreset", "type"),
    ["bad enum"] = (d => d["templateId"] = "T9", "/templateId", "enum"),
    ["number over maximum"] = (d => d["accentPreset"] = 3, "/accentPreset", "maximum"),
    ["bad body font"] = (d => d["layout"]!["bodyFont"] = "Not A Font", "/layout/bodyFont", "pattern"),
    ["margin not a multiple"] = (d => d["layout"]!["margins"]!["top"] = 23.3, "/layout/margins/top", "multiple_of"),
    ["margin under minimum"] = (d => d["layout"]!["margins"]!["left"] = 9.5, "/layout/margins/left", "minimum"),
    ["contact id not a uuid"] = (d => d["header"]!["contacts"]![0]!["id"] = "abc", "/header/contacts/0/id", "format"),
    ["content not matching type"] = (d => d["sections"]![1]!["content"] = new JsonObject { ["body"] = new JsonArray() }, "/sections/1/content/items", "required"),
    ["unknown section type"] = (d => d["sections"]![0]!["type"] = "table", "/sections/0/type", "enum"),
    ["inline with zero paragraphs"] = (d => d["sections"]![3]!["content"]!["body"] = new JsonArray(), "/sections/3/content/body", "min_items"),
    ["inline with two paragraphs"] = (d => d["sections"]![3]!["content"]!["body"]!.AsArray().Add(new JsonObject { ["kind"] = "paragraph", ["inlines"] = new JsonArray() }), "/sections/3/content/body", "max_items"),
    ["nested list"] = (d => d["sections"]![1]!["content"]!["items"]![0]!["text"]![0] = new JsonObject { ["kind"] = "bulletList", ["items"] = new JsonArray(new JsonArray()) }, "/sections/1/content/items/0/text/0/kind", "enum"),
    ["bullet list without items"] = (d => d["sections"]![0]!["content"]!["body"]![0] = new JsonObject { ["kind"] = "bulletList", ["items"] = new JsonArray() }, "/sections/0/content/body/0/items", "min_items"),
    ["link without children"] = (d => d["sections"]![0]!["content"]!["body"]![0]!["inlines"]![0] = new JsonObject { ["kind"] = "link", ["url"] = "https://example.org", ["children"] = new JsonArray() }, Sum + "/children", "min_items"),
    ["empty text run"] = (d => d["sections"]![0]!["content"]!["body"]![0]!["inlines"]![0]!["value"] = "", Sum + "/value", "min_length"),
    ["month out of range"] = (d => d["sections"]![2]!["content"]!["entries"]![0]!["start"]!["month"] = 13, "/sections/2/content/entries/0/start/month", "maximum"),
    ["year out of range"] = (d => d["sections"]![2]!["content"]!["entries"]![0]!["start"]!["year"] = 1899, "/sections/2/content/entries/0/start/year", "minimum"),
    ["start as present"] = (d => d["sections"]![2]!["content"]!["entries"]![0]!["start"] = new JsonObject { ["kind"] = "present" }, "/sections/2/content/entries/0/start/kind", "const"),
    ["empty label"] = (d => d["sections"]![2]!["content"]!["labels"] = new JsonObject { ["title"] = "", ["organization"] = null, ["location"] = null }, "/sections/2/content/labels/title", "min_length"),
  };

  [Theory]
  [MemberData(nameof(ReaderCases))]
  public void D04ClosedSchemaViolationsReportPointerAndCodeAndTheContractAgrees(string name)
  {
    var (change, pointer, code) = ReaderTable[name];
    var document = P07Docs.Full();
    change(document);
    Assert.False(P07Contract.IsValid("ResumeDocument", document.ToJsonString()), "The contract schema must reject this case too");
    var read = Read(document);
    Assert.Null(read.Document);
    Assert.Contains(read.Issues, issue => issue.Location == "body" && issue.JsonPointer == pointer && issue.Code == code);
  }

  [Theory]
  [InlineData("javascript:alert(1)")]
  [InlineData("data:text/html,x")]
  [InlineData("file:///etc/passwd")]
  [InlineData("HTTPS://example.org")]
  [InlineData("https://exa mple.org")]
  [InlineData("https://example.org/\u0007")]
  public void D05DisallowedLinkUrlsAreRejectedAndTheContractAgrees(string url)
  {
    var document = P07Docs.Full();
    document["header"]!["contacts"]![0]!["url"] = url;
    Assert.False(P07Contract.IsValid("ResumeDocument", document.ToJsonString()), "The contract schema must reject this URL too");
    Assert.False(SafeUrl.IsValid(url));
    var read = Read(document);
    Assert.Null(read.Document);
    Assert.Contains(read.Issues, issue => issue.JsonPointer == "/header/contacts/0/url" && issue.Code == "pattern");
  }

  [Theory]
  [InlineData("contacts")]
  [InlineData("sections")]
  [InlineData("list items")]
  [InlineData("entries")]
  [InlineData("across collections")]
  public void D06DuplicateIdsAreRejectedAtTheSecondOccurrence(string where)
  {
    var document = P07Docs.Full();
    var contacts = document["header"]!["contacts"]!;
    var sections = document["sections"]!;
    string pointer;
    switch (where)
    {
      case "contacts": contacts[1]!["id"] = contacts[0]!["id"]!.ToString(); pointer = "/header/contacts/1/id"; break;
      case "sections": sections[1]!["id"] = sections[0]!["id"]!.ToString(); pointer = "/sections/1/id"; break;
      case "list items": sections[1]!["content"]!["items"]![1]!["id"] = sections[1]!["content"]!["items"]![0]!["id"]!.ToString(); pointer = "/sections/1/content/items/1/id"; break;
      case "entries": sections[2]!["content"]!["entries"]![1]!["id"] = sections[2]!["content"]!["entries"]![0]!["id"]!.ToString(); pointer = "/sections/2/content/entries/1/id"; break;
      default: sections[3]!["id"] = contacts[0]!["id"]!.ToString().ToUpperInvariant(); pointer = "/sections/3/id"; break;
    }
    var issues = IssuesOf(document);
    Assert.Contains(issues, issue => issue.JsonPointer == pointer && issue.Code == "duplicate_id");
  }

  public static TheoryData<string> LimitCases => [.. LimitTable.Keys];

  private static readonly Dictionary<string, (int Limit, Func<int, JsonObject> Build, string Pointer, string Code)> LimitTable = new()
  {
    ["sections"] = (ResumeLimits.Sections, n => P07Docs.WithSections([.. Enumerable.Range(0, n).Select(_ => P07Docs.TextSection("x"))]), "/sections", "max_items"),
    ["entries"] = (ResumeLimits.Entries, n => P07Docs.WithSections(P07Docs.EntriesSection([.. Enumerable.Range(0, n).Select(_ => P07Docs.Entry())])), "/sections/0/content/entries", "max_items"),
    ["list items"] = (ResumeLimits.ListItems, n => P07Docs.WithSections(P07Docs.ListSection([.. Enumerable.Range(0, n).Select(_ => P07Docs.Item())])), "/sections/0/content/items", "max_items"),
    ["contacts"] = (ResumeLimits.Contacts, n => { var d = P07Docs.Blank(); d["header"]!["contacts"] = new JsonArray([.. Enumerable.Range(0, n).Select(_ => P07Docs.Contact())]); return d; }, "/header/contacts", "max_items"),
    ["title"] = (ResumeLimits.Title, n => P07Docs.Blank(new string('t', n)), "/title", "max_length"),
    ["full name"] = (ResumeLimits.FullName, n => { var d = P07Docs.Blank(); d["header"]!["fullName"] = new string('n', n); return d; }, "/header/fullName", "max_length"),
    ["headline"] = (ResumeLimits.Headline, n => { var d = P07Docs.Blank(); d["header"]!["headline"] = new string('h', n); return d; }, "/header/headline", "max_length"),
    ["contact text"] = (ResumeLimits.ContactText, n => { var d = P07Docs.Blank(); d["header"]!["contacts"] = new JsonArray(P07Docs.Contact(new string('c', n))); return d; }, "/header/contacts/0/text", "max_length"),
    ["section title"] = (ResumeLimits.SectionTitle, n => P07Docs.WithSections(P07Docs.TextSection("x", new string('s', n))), "/sections/0/title", "max_length"),
    ["entry field"] = (ResumeLimits.EntryField, n => P07Docs.WithSections(P07Docs.EntriesSection(P07Docs.Entry(new string('e', n)))), "/sections/0/content/entries/0/title", "max_length"),
    ["date text"] = (ResumeLimits.DateText, n => { var e = P07Docs.Entry(); e["dateText"] = new string('d', n); return P07Docs.WithSections(P07Docs.EntriesSection(e)); }, "/sections/0/content/entries/0/dateText", "max_length"),
    ["label"] = (ResumeLimits.Label, n => { var s = P07Docs.EntriesSection(); s["content"]!["labels"] = new JsonObject { ["title"] = new string('l', n), ["organization"] = null, ["location"] = null }; return P07Docs.WithSections(s); }, "/sections/0/content/labels/title", "max_length"),
    ["url"] = (ResumeLimits.Url, n => { var d = P07Docs.Blank(); var c = P07Docs.Contact(); c["url"] = "https://e.org/" + new string('u', n - 14); d["header"]!["contacts"] = new JsonArray(c); return d; }, "/header/contacts/0/url", "max_length"),
  };

  /// <summary>L01 and L03: each NFR-12 limit passes exactly at the bound and fails one over, through reader and rules.</summary>
  [Theory]
  [MemberData(nameof(LimitCases))]
  public void L01L03EachLimitPassesAtTheBoundAndFailsOneOver(string name)
  {
    var (limit, build, pointer, code) = LimitTable[name];
    Assert.Empty(IssuesOf(build(limit)));
    Assert.Contains(IssuesOf(build(limit + 1)), issue => issue.JsonPointer == pointer && issue.Code == code);
  }

  /// <summary>L02 and U02: the total counts code points. 50 000 emoji pass, one more fails, and the UTF-16 length is twice that.</summary>
  [Fact]
  public void L02TotalTextLimitCountsCodePointsNotUtf16Units()
  {
    var emoji = string.Concat(Enumerable.Repeat("\U0001F600", 49_990));
    Assert.Equal(49_990, ResumeDocumentRules.CodePoints(emoji));
    Assert.Equal(99_980, emoji.Length);
    JsonObject Document(int extra) { var d = P07Docs.WithSections(P07Docs.Section("list", "", new JsonObject { ["items"] = new JsonArray(P07Docs.Item(emoji)) })); d["title"] = new string('t', extra); return d; }
    Assert.Empty(IssuesOf(Document(10)));
    Assert.Contains(IssuesOf(Document(11)), issue => issue.JsonPointer == "" && issue.Code == "resume_text_limit_exceeded");
  }

  /// <summary>U02 on a single field: 150 emoji are 150 characters, not 300.</summary>
  [Fact]
  public void U02FieldLengthsCountCodePoints()
  {
    Assert.Empty(IssuesOf(P07Docs.Blank(string.Concat(Enumerable.Repeat("\U0001F600", 150)))));
    Assert.Contains(IssuesOf(P07Docs.Blank(string.Concat(Enumerable.Repeat("\U0001F600", 151)))), issue => issue.JsonPointer == "/title" && issue.Code == "max_length");
  }

  [Theory]
  [InlineData("{", false)]
  [InlineData("{\"a\":1,\"a\":2}", false)]
  [InlineData("{\"a\":\"\\ud83d\"}", false)]
  public void L05StrictJsonRejectsWhatTheCanonicalHashCannotDefine(string json, bool valid)
  {
    using var parsed = StrictJson.Parse(Encoding.UTF8.GetBytes(json));
    Assert.Equal(valid, parsed is not null);
  }

  [Fact]
  public void L05DepthBoundIsSixtyFour()
  {
    static string Nested(int depth) => string.Concat(Enumerable.Repeat("[", depth)) + string.Concat(Enumerable.Repeat("]", depth));
    using var atBound = StrictJson.Parse(Encoding.UTF8.GetBytes(Nested(ResumeLimits.MaxJsonDepth)));
    Assert.NotNull(atBound);
    using var over = StrictJson.Parse(Encoding.UTF8.GetBytes(Nested(ResumeLimits.MaxJsonDepth + 1)));
    Assert.Null(over);
  }
}
