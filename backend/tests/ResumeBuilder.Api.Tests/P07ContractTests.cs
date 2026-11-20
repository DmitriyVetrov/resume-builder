using System.Collections;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>The host's route inventory against the frozen contract (AC-P07-14).</summary>
public sealed class P07ContractTests
{
  private static readonly string[] ImplementedPhases = ["P04", "P06", "P07", "P11", "IMP-01"];

  [Fact]
  public void K01HostInventoryEqualsTheContractsImplementedOperationsWithTheirStatuses()
  {
    var expected = new Dictionary<string, string>(StringComparer.Ordinal);
    foreach (var path in P07Contract.Root["paths"]!.AsObject())
      foreach (var entry in path.Value!.AsObject())
        if (entry.Value is JsonObject operation && ImplementedPhases.Contains(operation["x-phase"]?.ToString()))
          expected[$"{entry.Key.ToUpperInvariant()} /api/v1{path.Key}"] = string.Join(',', operation["responses"]!.AsObject().Select(response => response.Key).Order(StringComparer.Ordinal));
    Assert.Equal(31, expected.Count);

    using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.UseSetting("Mongo:ConnectionString", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500"));
    using var client = factory.CreateClient();
    var providerType = Type.GetType("Microsoft.AspNetCore.OpenApi.IOpenApiDocumentProvider, Microsoft.AspNetCore.OpenApi");
    Assert.NotNull(providerType);
    var provider = factory.Services.GetService(providerType);
    Assert.NotNull(provider);
    var pending = providerType.GetMethod("GetOpenApiDocumentAsync")!.Invoke(provider, [TestContext.Current.CancellationToken])!;
    var awaiter = pending.GetType().GetMethod("GetAwaiter")!.Invoke(pending, null)!;
    var document = awaiter.GetType().GetMethod("GetResult")!.Invoke(awaiter, null)!;
    var actual = new Dictionary<string, string>(StringComparer.Ordinal);
    foreach (var pathEntry in (IEnumerable)document.GetType().GetProperty("Paths")!.GetValue(document)!)
    {
      var path = (string)pathEntry.GetType().GetProperty("Key")!.GetValue(pathEntry)!;
      var pathItem = pathEntry.GetType().GetProperty("Value")!.GetValue(pathEntry)!;
      foreach (var operationEntry in (IEnumerable)pathItem.GetType().GetProperty("Operations")!.GetValue(pathItem)!)
      {
        var method = operationEntry.GetType().GetProperty("Key")!.GetValue(operationEntry)!.ToString()!.ToUpperInvariant();
        var operation = operationEntry.GetType().GetProperty("Value")!.GetValue(operationEntry)!;
        var responses = (IEnumerable)operation.GetType().GetProperty("Responses")!.GetValue(operation)!;
        actual[$"{method} {path}"] = string.Join(',', responses.Cast<object>().Select(entry => entry.GetType().GetProperty("Key")!.GetValue(entry)!.ToString()).Order(StringComparer.Ordinal));
      }
    }
    Assert.Equal(expected.OrderBy(pair => pair.Key, StringComparer.Ordinal), actual.OrderBy(pair => pair.Key, StringComparer.Ordinal));
  }
}

/// <summary>K04: each error family is RFC 9457 with `traceId`, and the 412 extensions validate.</summary>
[Collection("P07")]
public sealed class P07ProblemShapeTests(P07Containers containers)
{
  [Fact]
  public async Task K04EachErrorFamilyHasTheContractProblemShape()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    (await user.Get("/api/v1/resumes/not-a-uuid")).AssertProblem(404, "not_found");
    (await user.Put(resume.Id, P07Docs.Blank(), null)).AssertProblem(428, "precondition_required");
    (await user.Send(HttpMethod.Put, resume.Path + "/document", P07User.Json("{"), resume.ETag)).AssertProblem(400, "malformed_request");
    (await user.Put(resume.Id, new JsonObject(), resume.ETag)).AssertProblem(400, "validation_failed");
    var saved = await user.Put(resume.Id, P07Docs.Blank("a"), resume.ETag);
    var stale = await user.Put(resume.Id, P07Docs.Blank("b"), resume.ETag);
    stale.AssertProblem(412, "version_mismatch");
    Assert.Equal(saved.Version, stale.Json["currentVersion"]!.GetValue<long>());
    var trashed = await user.Trash(resume.Id, saved.ETag);
    (await user.Trash(resume.Id, trashed.ETag)).AssertProblem(409, "resume_trashed");
    (await user.Restore(Guid.NewGuid(), "\"1\"")).AssertProblem(404, "not_found");
  }
}
