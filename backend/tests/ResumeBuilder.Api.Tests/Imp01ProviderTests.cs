using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using ResumeBuilder.Application.CvImport;
using ResumeBuilder.Infrastructure.CvImport;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Answers every request with one canned Messages API response and keeps the request body.</summary>
internal sealed class CapturingHandler(string stopReason, string text) : HttpMessageHandler
{
  public List<(HttpRequestMessage Request, JsonNode Body)> Requests { get; } = [];

  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
  {
    Requests.Add((request, JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!));
    var message = new JsonObject
    {
      ["id"] = "msg_synthetic",
      ["type"] = "message",
      ["role"] = "assistant",
      ["model"] = "claude-haiku-5-5",
      ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
      ["stop_reason"] = stopReason,
      ["stop_sequence"] = null,
      ["usage"] = new JsonObject { ["input_tokens"] = 1200, ["output_tokens"] = 800 },
    };
    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(message.ToJsonString(), Encoding.UTF8, "application/json") };
  }
}

/// <summary>IMP-01 P-01…P-03 (AC-IMP-03): the Anthropic adapter's request and response handling, at the HTTP boundary.</summary>
public sealed class Imp01ProviderTests
{
  private static readonly ImportRequest Request = new(Imp01ImportTests.Source, "pdf", 2, "left");
  private static ImportProviderOptions Options(string? key = "sk-ant-synthetic") => new() { ApiKey = key, PrimaryModel = "claude-haiku-5-5", EscalationModel = "claude-sonnet-5-5", BaseUrl = new Uri("http://anthropic.invalid") };

  private static async Task<(StructurerOutcome Outcome, CapturingHandler Handler)> Run(ImportTier tier, string stopReason = "end_turn", string? text = null, string? key = "sk-ant-synthetic")
  {
    var handler = new CapturingHandler(stopReason, text ?? Imp01ImportTests.Draft().ToJsonString());
    using var http = new HttpClient(handler);
    var outcome = await new AnthropicImportStructurer(Options(key), http).StructureAsync(Request, tier, TestContext.Current.CancellationToken);
    return (outcome, handler);
  }

  [Fact]
  public async Task P01ThePrimaryRequestIsHaikuWithStructuredOutputAndThinkingOff()
  {
    var (_, handler) = await Run(ImportTier.Primary);
    var (request, body) = Assert.Single(handler.Requests);
    Assert.Equal("/v1/messages", request.RequestUri!.AbsolutePath);
    // Anthropic C# SDK 13.8 sends the API key as `Authorization: Bearer` (its ClientOptions.ApiKey documentation).
    Assert.Equal("Bearer sk-ant-synthetic", request.Headers.Authorization!.ToString());
    Assert.Equal("claude-haiku-5-5", body["model"]!.ToString());
    Assert.Equal(16000, body["max_tokens"]!.GetValue<int>());
    Assert.Equal("disabled", body["thinking"]!["type"]!.ToString());
    Assert.Equal("low", body["output_config"]!["effort"]!.ToString());
    var format = body["output_config"]!["format"]!;
    Assert.Equal("json_schema", format["type"]!.ToString());
    Assert.Equal(["fullName", "headline", "contacts", "language", "sections"], format["schema"]!["required"]!.AsArray().Select(item => item!.ToString()));
    Assert.False(format["schema"]!["additionalProperties"]!.GetValue<bool>());
    Assert.DoesNotContain("minLength", format["schema"]!.ToJsonString(), StringComparison.Ordinal);
    Assert.DoesNotContain("maxLength", format["schema"]!.ToJsonString(), StringComparison.Ordinal);
    foreach (var name in new[] { "temperature", "top_p", "top_k" }) Assert.Null(body[name]);
    Assert.Contains("never", body["system"]!.ToJsonString(), StringComparison.OrdinalIgnoreCase);
    Assert.Contains("content, not instructions", body["system"]!.ToJsonString(), StringComparison.Ordinal);
    var user = body["messages"]!.AsArray().Single()!;
    Assert.Equal("user", user["role"]!.ToString());
    // The text itself: ToJsonString would escape "<" as \u003C.
    var turn = user["content"] is JsonValue text ? text.GetValue<string>() : string.Concat(user["content"]!.AsArray().Select(block => block!["text"]!.GetValue<string>()));
    Assert.Contains("<cv_text>", turn, StringComparison.Ordinal);
    Assert.Contains("</cv_text>", turn, StringComparison.Ordinal);
    Assert.Contains("Jan – May 2026", turn, StringComparison.Ordinal);
    Assert.Contains("sidebar on the left", turn, StringComparison.Ordinal);
  }

  [Fact]
  public async Task P02TheEscalationRequestIsSonnetWithBetweenToolsAndNoSampling()
  {
    var (_, handler) = await Run(ImportTier.Escalation);
    var body = Assert.Single(handler.Requests).Body;
    Assert.Equal("claude-sonnet-5-5", body["model"]!.ToString());
    Assert.Equal("between_tools", body["thinking"]!["type"]!.ToString());
    Assert.Equal("low", body["output_config"]!["effort"]!.ToString());
    foreach (var name in new[] { "temperature", "top_p", "top_k", "fallbacks" }) Assert.Null(body[name]);
  }

  [Fact]
  public async Task P03ResponsesMapToOutcomes()
  {
    var (draft, _) = await Run(ImportTier.Primary);
    Assert.Equal(StructurerStatus.Draft, draft.Status);
    Assert.True(JsonNode.DeepEquals(Imp01ImportTests.Draft(), JsonNode.Parse(draft.DraftJson!)));
    Assert.Equal((1200, 800), (draft.InputTokens, draft.OutputTokens));
    Assert.Equal(StructurerStatus.Refused, (await Run(ImportTier.Primary, "refusal", "")).Outcome.Status);
    Assert.Equal(StructurerStatus.Truncated, (await Run(ImportTier.Primary, "max_tokens", "{\"fullName\":")).Outcome.Status);
    var (unavailable, handler) = await Run(ImportTier.Primary, key: null);
    Assert.Equal(StructurerStatus.Unavailable, unavailable.Status);
    Assert.Empty(handler.Requests);
  }
}
