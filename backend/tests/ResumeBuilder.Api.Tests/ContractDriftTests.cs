using System.Text.Json;
using System.Text.Json.Serialization;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class ContractDriftTests
{
  private static readonly string Contract = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../..", "contracts/openapi/openapi.yaml"));
  private static readonly JsonSerializerOptions Strict = new()
  {
    UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    RespectNullableAnnotations = true,
    RespectRequiredConstructorParameters = true
  };

  [Fact]
  public void FrozenP04OperationsHaveExactMethodPathStatusAndAnonymousSecurity()
  {
    Assert.True(File.Exists(Contract), "Frozen OpenAPI contract is missing");
    var inventory = ReadP04Inventory(File.ReadAllText(Contract));
    var server = GetServerBasePath();
    Assert.Equal("/api/v1", server);
    Assert.Equal(2, inventory.Count);
    Assert.Equal("200,429,default", inventory["GET /health/live"].Statuses);
    Assert.Equal("200,429,503,default", inventory["GET /health/ready"].Statuses);
    Assert.Equal(["GET /api/v1/health/live", "GET /api/v1/health/ready"], inventory.Keys.Select(key => key.Replace("GET /health/", $"GET {server}/health/", StringComparison.Ordinal)).OrderBy(key => key));
    Assert.All(inventory.Values, operation => Assert.True(operation.Anonymous));
  }

  [Fact]
  public void InventoryComparisonRejectsExtraOperationOrChangedStatusAndSecurity()
  {
    var expected = new Dictionary<string, Operation>
    {
      ["GET /health/live"] = new("200,429,default", true),
      ["GET /health/ready"] = new("200,429,503,default", true)
    };
    Assert.False(InventoryEquals(expected, expected.Append(new KeyValuePair<string, Operation>("GET /other", new("200", true))).ToDictionary(x => x.Key, x => x.Value)));
    Assert.False(InventoryEquals(expected, expected.ToDictionary(x => x.Key, x => x.Key.EndsWith("live", StringComparison.Ordinal) ? new Operation("200,default", true) : x.Value)));
    Assert.False(InventoryEquals(expected, expected.ToDictionary(x => x.Key, x => x.Key.EndsWith("live", StringComparison.Ordinal) ? new Operation(x.Value.Statuses, false) : x.Value)));
  }

  [Fact]
  public void HealthExampleStrictlyRoundTripsAndRejectsDrift()
  {
    Assert.True(File.Exists(Contract), "Frozen OpenAPI contract is missing");
    Assert.Contains("status: ok", File.ReadAllText(Contract));
    const string example = "{\"status\":\"ok\"}";
    var parsed = JsonSerializer.Deserialize<HealthStatus>(example, Strict);
    Assert.Equal("ok", parsed?.Status);
    Assert.True(JsonElement.DeepEquals(JsonDocument.Parse(example).RootElement, JsonSerializer.SerializeToElement(parsed, Strict)));
    Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<HealthStatus>("{\"status\":\"ok\",\"extra\":1}", Strict));
    Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<HealthStatus>("{}", Strict));
  }

  [Fact]
  public void JsonSchemaValidatorRejectsMalformedHealthAndProblemBodies()
  {
    Assert.True(ContractSchemas.IsValid("HealthStatus", "{\"status\":\"ok\"}"));
    Assert.False(ContractSchemas.IsValid("HealthStatus", "{\"status\":\"bad\"}"));
    Assert.True(ContractSchemas.IsValid("Problem", "{\"title\":\"Unavailable\",\"status\":503,\"code\":\"service_unavailable\",\"traceId\":\"trace-1\"}"));
    Assert.False(ContractSchemas.IsValid("Problem", "{\"title\":\"Unavailable\",\"status\":200,\"code\":\"bad\",\"traceId\":\"\"}"));
  }

  [Theory]
  [InlineData("ProblemRateLimited", 429, "rate_limited")]
  [InlineData("ProblemServiceUnavailable", 503, "service_unavailable")]
  [InlineData("ProblemInternalError", 500, "internal_error")]
  public void FrozenProblemExamplesStrictlyRoundTrip(string name, int status, string code)
  {
    var example = ContractSchemas.ExampleJson(name);
    var problem = JsonSerializer.Deserialize<ProblemDto>(example, Strict);
    Assert.NotNull(problem);
    Assert.Equal(status, problem.Status);
    Assert.Equal(code, problem.Code);
    Assert.True(JsonElement.DeepEquals(JsonDocument.Parse(example).RootElement, JsonSerializer.SerializeToElement(problem, Strict)));
    Assert.True(ContractSchemas.IsValid("Problem", example));
    Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ProblemDto>("{\"title\":\"Error\",\"status\":500,\"code\":\"internal_error\",\"traceId\":\"t\",\"unexpected\":1}", Strict));
    Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ProblemDto>("{\"title\":\"Error\",\"status\":500,\"code\":\"internal_error\"}", Strict));
  }

  private sealed record HealthStatus([property: JsonPropertyName("status")] string Status);
  private sealed record ProblemDto(
      [property: JsonPropertyName("type")] string? Type,
      [property: JsonPropertyName("title")] string Title,
      [property: JsonPropertyName("status")] int Status,
      [property: JsonPropertyName("code")] string Code,
      [property: JsonPropertyName("traceId")] string TraceId,
      [property: JsonPropertyName("detail")] string? Detail = null,
      [property: JsonPropertyName("errors")] object? Errors = null);
  private sealed record Operation(string Statuses, bool Anonymous);
  internal static string GetServerBasePath()
  {
    var match = System.Text.RegularExpressions.Regex.Match(File.ReadAllText(Contract), @"(?m)^servers:\s*\n  - url: (/[^\s]+)");
    Assert.True(match.Success, "Frozen contract must declare a server URL");
    return match.Groups[1].Value.TrimEnd('/');
  }
  private static bool InventoryEquals(Dictionary<string, Operation> left, Dictionary<string, Operation> right) =>
      left.Count == right.Count && left.All(x => right.TryGetValue(x.Key, out var value) && x.Value == value);

  private static Dictionary<string, Operation> ReadP04Inventory(string yaml)
  {
    var result = new Dictionary<string, Operation>();
    var lines = yaml.Split('\n');
    string? path = null, method = null;
    var status = new List<string>();
    var phase = false;
    var anonymous = false;
    var inResponses = false;
    void Finish()
    {
      if (phase && path is not null && method is not null)
        result[$"{method} {path}"] = new Operation(string.Join(',', status), anonymous);
      status.Clear(); phase = false; anonymous = false; inResponses = false;
    }
    foreach (var line in lines)
    {
      if (line.StartsWith("  /", StringComparison.Ordinal)) { Finish(); path = line.Trim().TrimEnd(':'); method = null; }
      else if (line.StartsWith("    get:", StringComparison.Ordinal) || line.StartsWith("    post:", StringComparison.Ordinal) || line.StartsWith("    put:", StringComparison.Ordinal) || line.StartsWith("    delete:", StringComparison.Ordinal) || line.StartsWith("    patch:", StringComparison.Ordinal))
      { Finish(); method = line.Trim().TrimEnd(':').ToUpperInvariant(); }
      else if (method is not null)
      {
        if (line.Trim() == "x-phase: P04") phase = true;
        if (line.Trim() == "security: []") anonymous = true;
        if (line == "      responses:") inResponses = true;
        else if (inResponses && line.StartsWith("        '", StringComparison.Ordinal)) status.Add(line.Trim().Split('\'')[1]);
        else if (inResponses && line.StartsWith("        default:", StringComparison.Ordinal)) status.Add("default");
      }
    }
    Finish();
    return result;
  }
}
