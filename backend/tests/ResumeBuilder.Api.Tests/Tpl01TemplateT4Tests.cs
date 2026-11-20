using System.Text.Json;
using System.Text.Json.Nodes;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>TPL-01 (ADR-054): template T4 is accepted, stored and returned; contract 1.1.0.</summary>
[Collection("P07")]
public sealed class Tpl01TemplateT4Tests(P07Containers containers)
{
  private static JsonObject WithTemplate(string id)
  {
    var document = P07Docs.Full();
    document["templateId"] = id;
    return document;
  }

  private static IReadOnlyList<DocumentIssue> IssuesOf(JsonNode document)
  {
    using var parsed = JsonDocument.Parse(document.ToJsonString());
    return ResumeDocumentReader.Read(parsed.RootElement).Issues;
  }

  [Fact]
  public void B01aTheReaderAndTheContractAcceptT4AndStillRejectAnUnknownTemplate()
  {
    Assert.True(P07Contract.IsValid("ResumeDocument", WithTemplate("T4").ToJsonString()), "The contract must accept T4");
    Assert.Empty(IssuesOf(WithTemplate("T4")));
    var issue = Assert.Single(IssuesOf(WithTemplate("T9")));
    Assert.Equal("/templateId", issue.JsonPointer);
    Assert.False(P07Contract.IsValid("ResumeDocument", WithTemplate("T9").ToJsonString()));
  }

  [Fact]
  public async Task B01bAT4ResumeIsCreatedReadAndListedWithItsTemplate()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var created = await user.Create(WithTemplate("T4"));
    Assert.Equal(201, created.Code);
    created.AssertValid("Resume");
    Assert.Equal("T4", created.Json["document"]!["templateId"]!.ToString());
    var id = created.Json["id"]!.ToString();
    var read = await user.Get($"/api/v1/resumes/{id}");
    Assert.Equal(200, read.Code);
    Assert.True(P07Docs.SameJson(WithTemplate("T4").ToJsonString(), read.Json["document"]!.ToJsonString()));
    var list = await user.Get("/api/v1/resumes");
    Assert.Equal(200, list.Code);
    list.AssertValid("ResumePage");
    Assert.Equal("T4", list.Json["items"]!.AsArray().Single(item => item!["id"]!.ToString() == id)!["templateId"]!.ToString());
  }
}
