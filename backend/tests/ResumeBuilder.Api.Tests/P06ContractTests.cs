using System.Text.Json.Nodes;
using YamlDotNet.Serialization;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class P06ContractTests
{
  private static readonly string Contract = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../..", "contracts/openapi/openapi.yaml"));
  private static JsonNode ReadContract()
  {
    var yaml = new DeserializerBuilder().Build().Deserialize<object>(File.ReadAllText(Contract));
    return JsonNode.Parse(new SerializerBuilder().JsonCompatible().Build().Serialize(yaml))!;
  }

  [Fact]
  public void P06FrozenInventoryContainsExactlyApprovedFirstPartyOperations()
  {
    var contract = ReadContract();
    Assert.Equal("/api/v1", contract["servers"]![0]!["url"]!.ToString());
    var actual = new Dictionary<string, string>();
    foreach (var path in contract["paths"]!.AsObject())
      foreach (var method in path.Value!.AsObject())
        if (method.Value is JsonObject operation && operation["x-phase"]?.ToString() == "P06")
          actual[$"{method.Key.ToUpperInvariant()} {path.Key}"] = method.Value["operationId"]!.ToString();
    var expected = new Dictionary<string, string>
    {
      ["GET /session"] = "getSession",
      ["POST /auth/sign-up"] = "signUp",
      ["POST /auth/verify-email"] = "verifyEmail",
      ["POST /auth/resend-verification"] = "resendVerification",
      ["POST /auth/login"] = "login",
      ["POST /auth/logout"] = "logout",
      ["POST /auth/password-reset/request"] = "requestPasswordReset",
      ["POST /auth/password-reset/confirm"] = "confirmPasswordReset",
      ["POST /auth/reauthenticate"] = "reauthenticate",
      ["PUT /account/password"] = "changePassword",
      ["DELETE /account"] = "requestAccountDeletion",
      ["GET /account/data-export"] = "exportAccountData"
    };
    Assert.Equal(expected.OrderBy(x => x.Key), actual.OrderBy(x => x.Key));
    Assert.DoesNotContain(actual.Keys, key => key.Contains("google", StringComparison.OrdinalIgnoreCase) || key.Contains("oauth", StringComparison.OrdinalIgnoreCase) || key.Contains("guest", StringComparison.OrdinalIgnoreCase));
  }

  [Fact]
  public void P06ContractExamplesValidateAndMalformedProblemsFail()
  {
    Assert.Equal("false", JsonNode.Parse(ContractSchemas.ExampleJson("SessionAnonymous"))!["authenticated"]!.ToString());
    Assert.True(ContractSchemas.IsValid("Problem", ContractSchemas.ExampleJson("ProblemRateLimited")));
    Assert.False(ContractSchemas.IsValid("Problem", "{\"title\":\"Failure\",\"status\":429,\"code\":\"rate_limited\"}"));
  }
}
