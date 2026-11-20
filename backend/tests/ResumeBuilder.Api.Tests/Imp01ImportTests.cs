using System.Collections.Concurrent;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ResumeBuilder.Application.CvImport;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>A provider that answers from a script and records every call; no network (IMP-01 test plan, "Fixtures").</summary>
internal sealed class ScriptedStructurer : IImportStructurer
{
  private readonly ConcurrentQueue<StructurerOutcome> script = new();
  public ConcurrentQueue<(ImportRequest Request, ImportTier Tier)> Calls { get; } = new();
  /// <summary>Answered when the script is empty.</summary>
  public StructurerOutcome Default { get; set; } = new(StructurerStatus.Unavailable);

  public ScriptedStructurer Then(StructurerOutcome outcome) { script.Enqueue(outcome); return this; }
  public ScriptedStructurer ThenDraft(JsonNode draft) => Then(new StructurerOutcome(StructurerStatus.Draft, draft.ToJsonString(), 1200, 800));

  public Task<StructurerOutcome> StructureAsync(ImportRequest request, ImportTier tier, CancellationToken cancellationToken)
  {
    Calls.Enqueue((request, tier));
    return Task.FromResult(script.TryDequeue(out var next) ? next : Default);
  }
}

/// <summary>IMP-01 B-01…B-16 (AC-IMP-03): `structureResumeImport` against the scripted provider.</summary>
[Collection("P07")]
public sealed class Imp01ImportTests(P07Containers containers)
{
  private const string Path = "/api/v1/resume-imports/structure";
  internal const string Source = """
    [M b 22] Alex Sample
    [M b 13] Platform Engineer
    [S b 8.5] CONTACT
    [S li] alex.sample@example.com
    [M b 11] WORK EXPERIENCE
    [M b] Platform Engineer | Jan – May 2026
    [M i] Example Systems · Springfield
    [M li] Built the <a href="https://example.com/">example.com</a> platform.
    [M li] Cut build times in half.
    """;

  internal static JsonObject Draft() => new()
  {
    ["fullName"] = "Alex Sample",
    ["headline"] = "Platform Engineer",
    ["contacts"] = new JsonArray(new JsonObject { ["text"] = "alex.sample@example.com", ["kind"] = "email" }),
    ["language"] = "en",
    ["sections"] = new JsonArray(new JsonObject
    {
      ["title"] = "Work Experience",
      ["type"] = "entries",
      ["placement"] = "main",
      ["blocks"] = new JsonArray(),
      ["items"] = new JsonArray(),
      ["entries"] = new JsonArray(new JsonObject
      {
        ["title"] = "Platform Engineer",
        ["organization"] = "Example Systems",
        ["location"] = "Springfield",
        ["start"] = new JsonObject { ["year"] = 2026, ["month"] = 1 },
        ["end"] = new JsonObject { ["year"] = 2026, ["month"] = 5 },
        ["present"] = false,
        ["dateText"] = null,
        ["blocks"] = new JsonArray(
          new JsonObject { ["kind"] = "bullet", ["text"] = "Built the <a href=\"https://example.com/\">example.com</a> platform." },
          new JsonObject { ["kind"] = "bullet", ["text"] = "Cut build times in half." }),
      }),
    }),
  };

  internal static JsonObject Request(string source = Source) => new()
  {
    ["sourceText"] = source,
    ["sourceFormat"] = "pdf",
    ["layoutHint"] = new JsonObject { ["columns"] = 2, ["sidebarSide"] = "left" },
  };

  private static P07Host Host(P07Containers containers, ScriptedStructurer structurer) =>
    new(containers, services => { services.RemoveAll<IImportStructurer>(); services.AddSingleton<IImportStructurer>(structurer); });

  private static Task<P07Response> Post(P07User user, JsonNode body) => user.Send(HttpMethod.Post, Path, P07User.Json(body));
  private static JsonObject Entry(JsonNode draft) => draft["sections"]![0]!["entries"]![0]!.AsObject();

  [Fact]
  public async Task B01AVerbatimPrimaryDraftAnswers200WithTheDraft()
  {
    var structurer = new ScriptedStructurer().ThenDraft(Draft());
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    var response = await Post(user, Request());
    Assert.Equal(200, response.Code);
    response.AssertValid("ImportStructureResult");
    Assert.Equal("no-store", response.CacheControl);
    Assert.True(JsonNode.DeepEquals(Draft(), response.Json["draft"]));
    Assert.False(response.Json["escalated"]!.GetValue<bool>());
    Assert.Empty(response.Json["warnings"]!.AsArray());
    Assert.Equal([ImportTier.Primary], structurer.Calls.Select(call => call.Tier));
  }

  [Fact]
  public async Task B02NoSessionIs401AndNoCsrfTokenIs403()
  {
    var structurer = new ScriptedStructurer();
    using var host = Host(containers, structurer);
    var anonymous = new P07User(host, host.CreateClient(), "", Guid.Empty, "");
    (await anonymous.Send(HttpMethod.Post, Path, P07User.Json(Request()), withCsrf: false)).AssertProblem(401, "unauthenticated");
    var user = await host.SignIn();
    (await user.Send(HttpMethod.Post, Path, P07User.Json(Request()), withCsrf: false)).AssertProblem(403, "csrf_token_invalid");
    Assert.Empty(structurer.Calls);
  }

  [Fact]
  public async Task B03MediaTypeSizeAndSyntaxAreChecked()
  {
    var structurer = new ScriptedStructurer();
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    (await user.Send(HttpMethod.Post, Path, new StringContent("x", Encoding.UTF8, "text/plain"))).AssertProblem(415, "unsupported_media_type");
    (await user.Send(HttpMethod.Post, Path, new StringContent("{\"sourceText\":\"" + new string('a', 256 * 1024) + "\"}", Encoding.UTF8, "application/json"))).AssertProblem(413, "payload_too_large");
    (await user.Send(HttpMethod.Post, Path, new StringContent("{nope", Encoding.UTF8, "application/json"))).AssertProblem(400, "malformed_request");
    Assert.Empty(structurer.Calls);
  }

  public static TheoryData<string, string> SchemaViolations => new()
  {
    { "{\"sourceFormat\":\"pdf\",\"layoutHint\":{\"columns\":1,\"sidebarSide\":null}}", "/sourceText" },
    { "{\"sourceText\":\"\",\"sourceFormat\":\"pdf\",\"layoutHint\":{\"columns\":1,\"sidebarSide\":null}}", "/sourceText" },
    { "{\"sourceText\":\"" + new string('a', 60001) + "\",\"sourceFormat\":\"pdf\",\"layoutHint\":{\"columns\":1,\"sidebarSide\":null}}", "/sourceText" },
    { "{\"sourceText\":\"x\",\"sourceFormat\":\"rtf\",\"layoutHint\":{\"columns\":1,\"sidebarSide\":null}}", "/sourceFormat" },
    { "{\"sourceText\":\"x\",\"sourceFormat\":\"pdf\",\"layoutHint\":{\"columns\":3,\"sidebarSide\":null}}", "/layoutHint/columns" },
    { "{\"sourceText\":\"x\",\"sourceFormat\":\"pdf\",\"layoutHint\":{\"columns\":1,\"sidebarSide\":\"top\"}}", "/layoutHint/sidebarSide" },
    { "{\"sourceText\":\"x\",\"sourceFormat\":\"pdf\",\"layoutHint\":{\"columns\":1,\"sidebarSide\":null},\"model\":\"opus\"}", "/model" },
  };

  [Theory]
  [MemberData(nameof(SchemaViolations))]
  public async Task B04SchemaViolationsAre400WithAPointer(string body, string field)
  {
    var structurer = new ScriptedStructurer();
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    var response = await user.Send(HttpMethod.Post, Path, new StringContent(body, Encoding.UTF8, "application/json"));
    response.AssertProblem(400, "validation_failed");
    Assert.Contains(response.Json["errors"]!.AsArray(), issue => issue!["pointer"]!.ToString() == field);
    Assert.Empty(structurer.Calls);
  }

  [Fact]
  public async Task B05ANonVerbatimPrimaryDraftEscalatesOnce()
  {
    var invented = Draft();
    invented["headline"] = "Visionary Platform Leader";
    var structurer = new ScriptedStructurer().ThenDraft(invented).ThenDraft(Draft());
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    var response = await Post(user, Request());
    Assert.Equal(200, response.Code);
    Assert.True(response.Json["escalated"]!.GetValue<bool>());
    Assert.Equal("Platform Engineer", response.Json["draft"]!["headline"]!.ToString());
    Assert.Equal([ImportTier.Primary, ImportTier.Escalation], structurer.Calls.Select(call => call.Tier));
  }

  [Fact]
  public async Task B06ASchemaInvalidPrimaryDraftEscalatesOnce()
  {
    var structurer = new ScriptedStructurer().Then(new StructurerOutcome(StructurerStatus.Draft, "{\"fullName\":5}")).ThenDraft(Draft());
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    var response = await Post(user, Request());
    Assert.Equal(200, response.Code);
    Assert.True(response.Json["escalated"]!.GetValue<bool>());
    Assert.Equal(2, structurer.Calls.Count);
  }

  [Theory]
  [InlineData(StructurerStatus.Refused)]
  [InlineData(StructurerStatus.Truncated)]
  [InlineData(StructurerStatus.Failed)]
  public async Task B07RefusalTruncationOrTimeoutOnThePrimaryEscalatesOnce(StructurerStatus status)
  {
    var structurer = new ScriptedStructurer().Then(new StructurerOutcome(status)).ThenDraft(Draft());
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    var response = await Post(user, Request());
    Assert.Equal(200, response.Code);
    Assert.True(response.Json["escalated"]!.GetValue<bool>());
    Assert.Equal([ImportTier.Primary, ImportTier.Escalation], structurer.Calls.Select(call => call.Tier));
  }

  [Fact]
  public async Task B08TheEscalationDraftLosesOnlyItsNonVerbatimStrings()
  {
    var invented = Draft();
    Entry(invented)["organization"] = "Example Corporation";
    Entry(invented)["blocks"]!.AsArray().Add(new JsonObject { ["kind"] = "bullet", ["text"] = "Led a team of fifty." });
    Entry(invented)["start"] = new JsonObject { ["year"] = 2025, ["month"] = 1 };
    var structurer = new ScriptedStructurer().ThenDraft(invented).ThenDraft(invented);
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    var response = await Post(user, Request());
    Assert.Equal(200, response.Code);
    response.AssertValid("ImportStructureResult");
    var entry = Entry(response.Json["draft"]!);
    Assert.Null(entry["organization"]);
    Assert.Null(entry["start"]);
    Assert.Equal(2, entry["blocks"]!.AsArray().Count);
    Assert.Equal("Platform Engineer", entry["title"]!.ToString());
    var warnings = response.Json["warnings"]!.AsArray().Select(item => $"{item!["code"]} {item["pointer"]}").ToArray();
    Assert.Equal(["not_in_source /sections/0/entries/0/organization", "not_in_source /sections/0/entries/0/start", "not_in_source /sections/0/entries/0/blocks/2/text"], warnings);
  }

  [Theory]
  [InlineData(StructurerStatus.Refused)]
  [InlineData(StructurerStatus.Truncated)]
  [InlineData(StructurerStatus.Failed)]
  public async Task B09AFailedEscalationIs503AndNeverAThirdCall(StructurerStatus status)
  {
    var structurer = new ScriptedStructurer().Then(new StructurerOutcome(StructurerStatus.Refused)).Then(new StructurerOutcome(status));
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    (await Post(user, Request())).AssertProblem(503, "import_unavailable");
    Assert.Equal(2, structurer.Calls.Count);
    var invalid = new ScriptedStructurer().Then(new StructurerOutcome(StructurerStatus.Refused)).Then(new StructurerOutcome(StructurerStatus.Draft, "[]"));
    using var second = Host(containers, invalid);
    (await Post(await second.SignIn(), Request())).AssertProblem(503, "import_unavailable");
    Assert.Equal(2, invalid.Calls.Count);
  }

  [Fact]
  public async Task B10AnEscalationDraftLeftWithoutNameAndSectionsIs503()
  {
    var invented = Draft();
    invented["fullName"] = "Somebody Else";
    invented["sections"] = new JsonArray();
    var structurer = new ScriptedStructurer().ThenDraft(invented).ThenDraft(invented);
    using var host = Host(containers, structurer);
    (await Post(await host.SignIn(), Request())).AssertProblem(503, "import_unavailable");
  }

  [Fact]
  public async Task B11AnUnavailableProviderIs503AfterOneAttempt()
  {
    var structurer = new ScriptedStructurer();
    using var host = Host(containers, structurer);
    (await Post(await host.SignIn(), Request())).AssertProblem(503, "import_unavailable");
    Assert.Equal([ImportTier.Primary], structurer.Calls.Select(call => call.Tier));
  }

  [Fact]
  public async Task B12LongStringsAreClampedAndSurplusItemsDropped()
  {
    var name = string.Concat(Enumerable.Repeat("Name ", 26));
    var items = Enumerable.Range(0, 105).Select(index => $"skill{index:D3}").ToArray();
    var source = $"[M b 22] {name}\n[S b] SKILLS\n" + string.Join('\n', items.Select(item => $"[S li] {item}"));
    var draft = new JsonObject
    {
      ["fullName"] = name.Trim(),
      ["headline"] = null,
      ["contacts"] = new JsonArray(),
      ["language"] = null,
      ["sections"] = new JsonArray(new JsonObject { ["title"] = "Skills", ["type"] = "list", ["placement"] = "sidebar", ["blocks"] = new JsonArray(), ["items"] = new JsonArray([.. items.Select(item => (JsonNode)item)]), ["entries"] = new JsonArray() }),
    };
    var structurer = new ScriptedStructurer().ThenDraft(draft);
    using var host = Host(containers, structurer);
    var response = await Post(await host.SignIn(), Request(source));
    Assert.Equal(200, response.Code);
    response.AssertValid("ImportStructureResult");
    Assert.Equal(120, response.Json["draft"]!["fullName"]!.ToString().Length);
    Assert.Equal(100, response.Json["draft"]!["sections"]![0]!["items"]!.AsArray().Count);
    var warnings = response.Json["warnings"]!.AsArray().Select(item => $"{item!["code"]} {item["pointer"]}").ToArray();
    Assert.Equal(["clamped /fullName", .. Enumerable.Range(100, 5).Select(index => $"over_limit /sections/0/items/{index}")], warnings);
  }

  /// <summary>External review R1: the contract caps `warnings` at 500, however many items the model returns.</summary>
  [Fact]
  public async Task B18WarningsStayWithinTheContractCap()
  {
    var contacts = Enumerable.Range(0, 1000).Select(index => $"contact{index:D4}@example.invalid").ToArray();
    var source = "[M b 22] Alex Sample\n" + string.Join('\n', contacts.Select(contact => $"[M] {contact}"));
    var draft = new JsonObject
    {
      ["fullName"] = "Alex Sample",
      ["headline"] = null,
      ["contacts"] = new JsonArray([.. contacts.Select(contact => (JsonNode)new JsonObject { ["text"] = contact, ["kind"] = "email" })]),
      ["language"] = null,
      ["sections"] = new JsonArray(),
    };
    var structurer = new ScriptedStructurer().ThenDraft(draft);
    using var host = Host(containers, structurer);
    var response = await Post(await host.SignIn(), Request(source));
    Assert.Equal(200, response.Code);
    response.AssertValid("ImportStructureResult");
    Assert.Equal(20, response.Json["draft"]!["contacts"]!.AsArray().Count);
    var warnings = response.Json["warnings"]!.AsArray();
    Assert.Equal(500, warnings.Count);
    Assert.Equal("over_limit /contacts/20", $"{warnings[0]!["code"]} {warnings[0]!["pointer"]}");
  }

  [Fact]
  public async Task B13TenPerHourAndThirtyPerDayPerUser()
  {
    var structurer = new ScriptedStructurer { Default = new StructurerOutcome(StructurerStatus.Draft, Draft().ToJsonString()) };
    using var host = Host(containers, structurer);
    var user = await host.SignIn();
    for (var hour = 0; hour < 3; hour++)
    {
      for (var index = 0; index < 10; index++) Assert.Equal(200, (await Post(user, Request())).Code);
      var limited = await Post(user, Request());
      limited.AssertProblem(429, "rate_limited");
      // The 31st request in the third hour also meets the daily limit, so its wait is the day window.
      var wait = int.Parse(limited.Headers.RetryAfter!.ToString(), System.Globalization.CultureInfo.InvariantCulture);
      Assert.True(hour < 2 ? wait is > 0 and <= 3600 : wait is > 3600 and <= 86400, $"hour {hour}: {wait}");
      host.Time.Advance(TimeSpan.FromMinutes(61));
    }
    var daily = await Post(user, Request());
    daily.AssertProblem(429, "rate_limited");
    Assert.Equal(30, structurer.Calls.Count);
    host.Time.Advance(TimeSpan.FromHours(22));
    Assert.Equal(200, (await Post(user, Request())).Code);
  }

  [Fact]
  public async Task B14NeitherTheSourceNorTheDraftReachesTheLog()
  {
    const string canary = "Zqxcanary";
    var draft = Draft();
    draft["fullName"] = $"Alex {canary}";
    var structurer = new ScriptedStructurer().ThenDraft(draft);
    using var host = Host(containers, structurer);
    var response = await Post(await host.SignIn(), Request(Source.Replace("Alex Sample", $"Alex {canary}", StringComparison.Ordinal)));
    Assert.Equal(200, response.Code);
    Assert.DoesNotContain(host.Logs.Entries, entry => entry.Message.Contains(canary, StringComparison.OrdinalIgnoreCase) || entry.Exception.Contains(canary, StringComparison.OrdinalIgnoreCase) || entry.Fields.Any(field => field.Value.Contains(canary, StringComparison.OrdinalIgnoreCase)));
    var line = Assert.Single(host.Logs.Entries, entry => entry.Fields.Any(field => field.Key == "EventName" && field.Value == "cv_import"));
    var fields = line.Fields.ToDictionary(field => field.Key, field => field.Value);
    Assert.Equal("draft", fields["Outcome"]);
    Assert.Equal("primary", fields["Tiers"]);
    Assert.Equal("1200", fields["InputTokens"]);
    Assert.Equal("800", fields["OutputTokens"]);
    Assert.True(double.Parse(fields["ElapsedMs"], System.Globalization.CultureInfo.InvariantCulture) >= 0);
  }

  [Fact]
  public async Task B15TwoUsersHaveTheirOwnLimits()
  {
    var structurer = new ScriptedStructurer { Default = new StructurerOutcome(StructurerStatus.Draft, Draft().ToJsonString()) };
    using var host = Host(containers, structurer);
    var first = await host.SignIn();
    var second = await host.SignIn();
    for (var index = 0; index < 10; index++) Assert.Equal(200, (await Post(first, Request())).Code);
    (await Post(first, Request())).AssertProblem(429, "rate_limited");
    Assert.Equal(200, (await Post(second, Request())).Code);
  }

  [Fact]
  public async Task B16TheProviderReceivesTheSourceAndTheHintUnchanged()
  {
    var structurer = new ScriptedStructurer().ThenDraft(Draft());
    using var host = Host(containers, structurer);
    Assert.Equal(200, (await Post(await host.SignIn(), Request())).Code);
    var (request, tier) = Assert.Single(structurer.Calls);
    Assert.Equal(new ImportRequest(Source, "pdf", 2, "left"), request);
    Assert.Equal(ImportTier.Primary, tier);
  }
}
