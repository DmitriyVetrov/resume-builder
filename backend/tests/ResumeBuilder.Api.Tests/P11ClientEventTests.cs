using System.Text;
using System.Text.Json.Nodes;
using Xunit;
using YamlDotNet.Serialization;

namespace ResumeBuilder.Api.Tests;

/// <summary>`reportClientEvents` as frozen (AC-P11-13, NFR-13, ADR-038): the only P11 operation.</summary>
[Collection("P07")]
public sealed class P11ClientEventTests(P07Containers containers)
{
  private const string Path = "/api/v1/client-events";
  private static readonly string ResumeId = Guid.NewGuid().ToString();

  private static JsonObject Event(string type = "preview_failed", string code = "font_load") => new()
  {
    ["type"] = type,
    ["code"] = code,
    ["resumeId"] = ResumeId,
    ["engineVersion"] = "1.0.0",
    ["occurredAt"] = "2026-11-06T10:15:30Z",
  };
  private static StringContent Batch(params JsonObject[] events) => P07User.Json(new JsonObject { ["events"] = new JsonArray([.. events.Select(item => (JsonNode)item)]) });

  [Fact]
  public async Task Ce01ValidBatchAnswers202WithNoBody()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var response = await user.Send(HttpMethod.Post, Path, Batch(Event(), Event("export_mismatch", "page_count.differs")));
    Assert.Equal(202, response.Code);
    Assert.Empty(response.Bytes);
  }

  [Fact]
  public async Task Ce02NoSessionAnswers401()
  {
    using var host = new P07Host(containers);
    var anonymous = new P07User(host, host.CreateClient(), "", Guid.Empty, "");
    (await anonymous.Send(HttpMethod.Post, Path, Batch(Event()), withCsrf: false)).AssertProblem(401, "unauthenticated");
  }

  [Fact]
  public async Task Ce03NoCsrfTokenAnswers403()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    (await user.Send(HttpMethod.Post, Path, Batch(Event()), withCsrf: false)).AssertProblem(403, "csrf_token_invalid");
  }

  [Fact]
  public async Task Ce04OtherMediaTypeAnswers415()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    (await user.Send(HttpMethod.Post, Path, new StringContent("events=1", Encoding.UTF8, "text/plain"))).AssertProblem(415, "unsupported_media_type");
  }

  [Fact]
  public async Task Ce05BodyOver16KbAnswers413()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var padded = "{\"events\":[" + new string(' ', 16 * 1024) + "]}";
    (await user.Send(HttpMethod.Post, Path, new StringContent(padded, Encoding.UTF8, "application/json"))).AssertProblem(413, "payload_too_large");
  }

  [Fact]
  public async Task Ce06BadJsonAnswers400()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    (await user.Send(HttpMethod.Post, Path, new StringContent("{not json", Encoding.UTF8, "application/json"))).AssertProblem(400, "malformed_request");
  }

  public static TheoryData<string, string> SchemaViolations => new()
  {
    { "{\"events\":[]}", "/events" },
    { "{}", "/events" },
    { "{\"events\":[],\"more\":1}", "/more" },
    { "{\"events\":[" + string.Join(",", Enumerable.Repeat(Event().ToJsonString(), 21)) + "]}", "/events" },
    { Wrap(item => item["type"] = "free text"), "/events/0/type" },
    { Wrap(item => item["code"] = "Has Spaces"), "/events/0/code" },
    { Wrap(item => item["code"] = new string('a', 65)), "/events/0/code" },
    { Wrap(item => item["code"] = 7), "/events/0/code" },
    { Wrap(item => item["resumeId"] = "not-a-uuid"), "/events/0/resumeId" },
    { Wrap(item => item["engineVersion"] = "has space"), "/events/0/engineVersion" },
    { Wrap(item => item["occurredAt"] = "yesterday"), "/events/0/occurredAt" },
    { Wrap(item => item.Remove("code")), "/events/0/code" },
    { Wrap(item => item.Remove("resumeId")), "/events/0/resumeId" },
    { Wrap(item => item["message"] = "free text"), "/events/0/message" },
  };
  private static string Wrap(Action<JsonObject> change)
  {
    var item = Event();
    change(item);
    return new JsonObject { ["events"] = new JsonArray(item) }.ToJsonString();
  }

  [Theory]
  [MemberData(nameof(SchemaViolations))]
  public async Task Ce07EachSchemaRuleAnswers400(string body, string location)
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var response = await user.Send(HttpMethod.Post, Path, new StringContent(body, Encoding.UTF8, "application/json"));
    response.AssertProblem(400, "validation_failed");
    Assert.Contains(response.Json["errors"]!.AsArray(), issue => issue!["pointer"]!.ToString() == location);
  }

  [Fact]
  public async Task Ce08Past30PerMinuteAnswers429WithRetryAfter()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    for (var attempt = 0; attempt < 30; attempt++) Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(Event()))).Code);
    var limited = await user.Send(HttpMethod.Post, Path, Batch(Event()));
    limited.AssertProblem(429, "rate_limited");
    Assert.True(limited.Headers.RetryAfter is not null);
    host.Time.Advance(TimeSpan.FromMinutes(1.1));
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(Event()))).Code);
  }

  [Fact]
  public async Task Ce09TheLogHoldsOnlyTheParsedFields()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var own = await user.Created();
    var logged = Event("autosave_failed", "resume_text_limit_exceeded");
    logged["resumeId"] = own.Id.ToString();
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(logged))).Code);
    var line = Assert.Single(host.Logs.Entries, entry => entry.Fields.Any(field => field.Key == "EventName" && field.Value == "client_event"));
    var fields = line.Fields.Where(field => field.Key != "{OriginalFormat}").ToDictionary(field => field.Key, field => field.Value);
    Assert.Equal(new Dictionary<string, string> { ["EventName"] = "client_event", ["Type"] = "autosave_failed", ["Code"] = "resume_text_limit_exceeded", ["ResumeId"] = own.Id.ToString(), ["EngineVersion"] = "1.0.0" }, fields);
    const string canary = "CANARY-private-resume-text";
    var rejected = await user.Send(HttpMethod.Post, Path, new StringContent(Wrap(item => item["code"] = canary), Encoding.UTF8, "application/json"));
    Assert.Equal(400, rejected.Code);
    Assert.DoesNotContain(canary, rejected.Body);
    Assert.DoesNotContain(host.Logs.Entries, entry => entry.Message.Contains(canary, StringComparison.Ordinal) || entry.Fields.Any(field => field.Value.Contains(canary, StringComparison.Ordinal)));
  }

  [Fact]
  public async Task Ce12TextThatFitsThePatternsIsAcceptedButNeverLogged()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var item = Event("autosave_failed", "lucia.nanez_senior-engineer");
    item["engineVersion"] = "Lucia.Nanez+private";
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(item))).Code);
    var line = Assert.Single(host.Logs.Entries, entry => entry.Fields.Any(field => field.Key == "EventName" && field.Value == "client_event"));
    Assert.Contains(line.Fields, field => field.Key == "Code" && field.Value == "other");
    Assert.Contains(line.Fields, field => field.Key == "EngineVersion" && field.Value == "other");
    Assert.DoesNotContain(host.Logs.Entries, entry => entry.Message.Contains("lucia", StringComparison.OrdinalIgnoreCase) || entry.Fields.Any(field => field.Value.Contains("lucia", StringComparison.OrdinalIgnoreCase)));
  }

  [Fact]
  public async Task Ce13AWellFormedEngineThisProductNeverShippedIsNotLogged()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var item = Event();
    item["engineVersion"] = "123.456.789";
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(item))).Code);
    Assert.DoesNotContain(host.Logs.Entries, entry => entry.Message.Contains("123.456.789", StringComparison.Ordinal));
    Assert.Contains(Lines(host), fields => fields["EngineVersion"] == "other");
  }

  [Theory]
  [InlineData("export_failed", "photo_load")]
  [InlineData("export_failed", "pdf_write")]
  [InlineData("export_failed", "txt_write")]
  [InlineData("export_failed", "font_load")]
  [InlineData("export_failed", "engine_load")]
  [InlineData("export_failed", "layout_error")]
  [InlineData("export_mismatch", "page_count.differs")]
  [InlineData("export_mismatch", "line_breaks.differs")]
  public async Task Ce15EveryExportCodeIsLoggedAsItself(string type, string code)
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(Event(type, code)))).Code);
    var line = Assert.Single(Lines(host));
    Assert.Equal(type, line["Type"]);
    Assert.Equal(code, line["Code"]);
  }

  [Theory]
  [InlineData("1.0.0")]
  [InlineData("1.1.0")]
  [InlineData("1.2.0")]
  public async Task Ce16EveryShippedEngineIsLoggedAsItself(string engine)
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var item = Event();
    item["engineVersion"] = engine;
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(item))).Code);
    Assert.Equal(engine, Assert.Single(Lines(host))["EngineVersion"]);
  }

  [Fact]
  public async Task Ce14AResumeIdIsLoggedOnlyForTheCallersOwnResume()
  {
    using var host = new P07Host(containers);
    var owner = await host.SignIn();
    var stranger = await host.SignIn();
    var own = await owner.Created();
    var item = Event();
    item["resumeId"] = own.Id.ToString();
    Assert.Equal(202, (await owner.Send(HttpMethod.Post, Path, Batch(item))).Code);
    Assert.Contains(Lines(host), fields => fields["ResumeId"] == own.Id.ToString());
    // Another user's ID, and a UUID that only carries chosen bytes: both accepted, neither logged.
    const string chosen = "6c756369-612d-6e61-6e65-7a2d70726976";
    foreach (var value in new[] { own.Id.ToString(), chosen })
    {
      host.Logs.Entries.Clear();
      var foreign = Event();
      foreign["resumeId"] = value;
      Assert.Equal(202, (await stranger.Send(HttpMethod.Post, Path, Batch(foreign))).Code);
      Assert.Equal("other", Assert.Single(Lines(host))["ResumeId"]);
    }
  }

  private static List<Dictionary<string, string>> Lines(P07Host host) =>
    [.. host.Logs.Entries.Where(entry => entry.Fields.Any(field => field.Key == "EventName" && field.Value == "client_event")).Select(entry => entry.Fields.Where(field => field.Key != "{OriginalFormat}").ToDictionary(field => field.Key, field => field.Value))];

  [Fact]
  public async Task Ce10NullResumeAndEngineAreAccepted()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var item = Event();
    item["resumeId"] = null;
    item["engineVersion"] = null;
    Assert.Equal(202, (await user.Send(HttpMethod.Post, Path, Batch(item))).Code);
  }

  [Fact]
  public void Ce11TheFrozenOperationListsTheStatusesThisEndpointAnswers()
  {
    var contract = System.IO.Path.GetFullPath(System.IO.Path.Combine(AppContext.BaseDirectory, "../../../../../..", "contracts/openapi/openapi.yaml"));
    var document = new DeserializerBuilder().Build().Deserialize<Dictionary<string, object>>(File.ReadAllText(contract));
    var paths = (Dictionary<object, object>)document["paths"];
    var post = (Dictionary<object, object>)((Dictionary<object, object>)paths["/client-events"])["post"];
    Assert.Equal("reportClientEvents", post["operationId"]);
    Assert.Equal(["202", "400", "401", "403", "413", "415", "429", "default"], ((Dictionary<object, object>)post["responses"]).Keys.Select(key => key.ToString()!));
  }
}
