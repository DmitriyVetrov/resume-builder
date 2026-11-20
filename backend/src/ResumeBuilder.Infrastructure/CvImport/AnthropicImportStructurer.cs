using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using ResumeBuilder.Application.CvImport;

namespace ResumeBuilder.Infrastructure.CvImport;

/// <summary>Configuration of the import provider (DD-IMP-09, DD-IMP-10). The key comes from `Anthropic:ApiKey`.</summary>
public sealed class ImportProviderOptions
{
  public string? ApiKey { get; init; }
  public string PrimaryModel { get; init; } = "claude-haiku-5-5";
  public string EscalationModel { get; init; } = "claude-sonnet-5-5";
  public TimeSpan Timeout { get; init; } = TimeSpan.FromSeconds(60);
  public Uri? BaseUrl { get; init; }
}

/// <summary>
/// ADR-055 §4: Claude through the official SDK. Structured output with the draft schema, thinking off
/// (`disabled` on Haiku 5.5, `between_tools` on Sonnet 5.5, which rejects `disabled`), effort low, no sampling
/// parameters, no SDK retries (the escalation is the retry). Nothing here logs the source or the response.
/// </summary>
public sealed class AnthropicImportStructurer(ImportProviderOptions options, HttpClient? http = null) : IImportStructurer
{
  private const int MaxTokens = 16000;
  private static readonly HttpClient SharedHttp = new();
  private static readonly Dictionary<string, JsonElement> Schema = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(ImportPrompt.DraftSchema)!;

  public async Task<StructurerOutcome> StructureAsync(ImportRequest request, ImportTier tier, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);
    if (string.IsNullOrWhiteSpace(options.ApiKey)) return new StructurerOutcome(StructurerStatus.Unavailable);
    var client = new AnthropicClient
    {
      ApiKey = options.ApiKey,
      MaxRetries = 0,
      Timeout = options.Timeout,
      HttpClient = http ?? SharedHttp,
      BaseUrl = options.BaseUrl?.ToString().TrimEnd('/') ?? "https://api.anthropic.com",
    };
    var parameters = new MessageCreateParams
    {
      Model = tier == ImportTier.Primary ? options.PrimaryModel : options.EscalationModel,
      MaxTokens = MaxTokens,
      System = ImportPrompt.System,
      Messages = [new UserMessageParam { Content = ImportPrompt.UserTurn(request) }],
      Thinking = tier == ImportTier.Primary ? new ThinkingConfigDisabled() : new ThinkingConfigBetweenTools(),
      OutputConfig = new OutputConfig { Effort = Effort.Low, Format = new JsonOutputFormat { Schema = Schema } },
    };
    Message message;
    try
    {
      message = await client.Messages.Create(parameters, cancellationToken);
    }
    catch (Exception error) when (error is AnthropicException or HttpRequestException or JsonException || (error is OperationCanceledException && !cancellationToken.IsCancellationRequested))
    {
      // A timeout, an API error or an unreadable response: the use case escalates or falls back.
      return new StructurerOutcome(StructurerStatus.Failed);
    }
    var usage = (message.Usage.InputTokens, message.Usage.OutputTokens);
    var reason = message.StopReason?.Raw();
    if (reason == "refusal") return new StructurerOutcome(StructurerStatus.Refused, null, usage.InputTokens, usage.OutputTokens);
    if (reason == "max_tokens") return new StructurerOutcome(StructurerStatus.Truncated, null, usage.InputTokens, usage.OutputTokens);
    var text = string.Concat(message.Content.Select(block => block.Value).OfType<TextBlock>().Select(block => block.Text));
    return new StructurerOutcome(StructurerStatus.Draft, text, usage.InputTokens, usage.OutputTokens);
  }
}
