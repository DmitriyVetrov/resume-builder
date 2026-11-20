using System.Text.Json.Nodes;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>The client's rich-text corpus through the real API (DD-P09-10). The stacks share this data file, not code.</summary>
[Collection("P07")]
public sealed class P09RichTextRoundTripTests(P07Containers containers)
{
  private static JsonArray Corpus()
  {
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "tests", "fixtures", "rich-text"))) directory = directory.Parent;
    Assert.NotNull(directory);
    return JsonNode.Parse(File.ReadAllText(Path.Combine(directory.FullName, "tests", "fixtures", "rich-text", "corpus.json")))!.AsArray();
  }

  private static JsonObject TextSection(string id, JsonNode? blocks) => new()
  {
    ["id"] = id,
    ["type"] = "text",
    ["title"] = "Rich",
    ["hidden"] = false,
    ["listColumns"] = null,
    ["placement"] = null,
    ["content"] = new JsonObject { ["body"] = blocks?.DeepClone() },
  };

  [Fact]
  public async Task T01EveryCorpusDocumentRoundTripsJsonEqualThroughTheApi()
  {
    await using var host = new P07Host(containers);
    var user = await host.SignIn();
    var created = await user.Created();
    var etag = created.ETag;
    foreach (var item in Corpus())
    {
      var document = P07Docs.Blank();
      document["sections"] = new JsonArray(TextSection(Guid.CreateVersion7().ToString(), item!["blocks"]));
      var put = await user.Put(created.Id, document, etag);
      Assert.True(put.Code == 200, $"{item["name"]}: {put.Code} {put.ProblemCode}");
      etag = put.ETag!;
      var read = await user.Get($"/api/v1/resumes/{created.Id}");
      Assert.True(P07Docs.SameJson(document.ToJsonString(), read.Json["document"]!.ToJsonString()), $"{item["name"]} changed in the round trip");
    }
  }

  [Theory]
  [InlineData("javascript:alert(1)")]
  [InlineData("HTTPS://upper.invalid")]
  public async Task T02AUrlTheClientMustNeverEmitIsRefused(string url)
  {
    await using var host = new P07Host(containers);
    var user = await host.SignIn();
    var created = await user.Created();
    var document = P07Docs.Blank();
    var link = new JsonObject { ["kind"] = "link", ["url"] = url, ["children"] = new JsonArray(new JsonObject { ["kind"] = "text", ["value"] = "x", ["bold"] = false, ["italic"] = false, ["underline"] = false }) };
    document["sections"] = new JsonArray(TextSection(Guid.CreateVersion7().ToString(), new JsonArray(new JsonObject { ["kind"] = "paragraph", ["inlines"] = new JsonArray(link) })));
    Assert.Equal(400, (await user.Put(created.Id, document, created.ETag)).Code);
  }
}
