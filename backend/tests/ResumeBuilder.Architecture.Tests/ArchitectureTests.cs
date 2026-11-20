using System.Xml.Linq;
using System.Text.RegularExpressions;
using Xunit;

namespace ResumeBuilder.Architecture.Tests;

public sealed class ArchitectureTests
{
  private static readonly string Root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../.."));
  private static readonly string Src = Path.Combine(Root, "src");
  private static readonly string[] Layers = ["Domain", "Application", "Infrastructure", "Api"];
  private static readonly string[] OperationalFields = ["EventName", "Code", "TraceId", "RouteTemplate", "Status", "ElapsedMs", "Type", "ResumeId", "EngineVersion",
    // IMP-01 (ADR-055 §6): the import event carries an outcome code, the tiers used and token counts, never text.
    "Outcome", "Tiers", "InputTokens", "OutputTokens"];

  [Theory]
  [InlineData("Domain")]
  [InlineData("Application")]
  [InlineData("Infrastructure")]
  [InlineData("Api")]
  public void RequiredLayerTargetsNet10(string layer)
  {
    var path = Project(layer);
    Assert.True(File.Exists(path), $"Required project is missing: {layer}");
    var xml = XDocument.Load(path);
    var framework = xml.Descendants("TargetFramework").SingleOrDefault()?.Value;
    Assert.True(framework is null or "net10.0", $"{layer} must target net10.0");
  }

  [Fact]
  public void ProjectReferencesFollowLayerDirection()
  {
    foreach (var layer in Layers)
    {
      var path = Project(layer);
      Assert.True(File.Exists(path), $"Required project is missing: {layer}");
      var xml = XDocument.Load(path);
      var actual = xml.Descendants("ProjectReference").Select(x => Path.GetFileNameWithoutExtension((string?)x.Attribute("Include") ?? "")).ToArray();
      var allowed = layer switch
      {
        "Domain" => Array.Empty<string>(),
        "Application" => ["ResumeBuilder.Domain"],
        "Infrastructure" => ["ResumeBuilder.Application", "ResumeBuilder.Domain"],
        _ => ["ResumeBuilder.Application", "ResumeBuilder.Infrastructure"]
      };
      Assert.Empty(ForbiddenEdges(layer, actual, allowed));
    }
  }

  [Fact]
  public void ForbiddenReferenceCheckerDetectsAnApplicationInfrastructureEdge()
  {
    Assert.Equal(["Application -> ResumeBuilder.Infrastructure"], ForbiddenEdges("Application", ["ResumeBuilder.Infrastructure"], ["ResumeBuilder.Domain"]));
  }

  [Fact]
  public void DomainHasNoExternalPackagesOrFrameworkReferences()
  {
    var path = Project("Domain");
    Assert.True(File.Exists(path), "Required project is missing: Domain");
    var xml = XDocument.Load(path);
    Assert.Empty(xml.Descendants("PackageReference"));
    Assert.Empty(xml.Descendants("FrameworkReference"));
  }

  [Fact]
  public void EndpointSourceDoesNotUsePersistenceSdk()
  {
    var path = Path.Combine(Src, "ResumeBuilder.Api");
    Assert.True(Directory.Exists(path), "Required Api source is missing");
    var inspected = 0;
    foreach (var file in ApiSources(path))
    {
      var source = File.ReadAllText(file);
      if (Path.GetFileName(file) == "Program.cs")
      {
        const string boundary = "var app = builder.Build();";
        Assert.Contains(boundary, source);
        source = source[(source.IndexOf(boundary, StringComparison.Ordinal) + boundary.Length)..];
      }
      inspected++;
      Assert.DoesNotContain("MongoDB.", source);
      Assert.DoesNotContain("Azure.Storage.", source);
    }
    Assert.True(inspected > 0, "The persistence guard must inspect Api source");
  }

  [Fact]
  public void FoundationDoesNotDeclareResumeRepositoryInterfaces()
  {
    var path = Path.Combine(Src, "ResumeBuilder.Application");
    Assert.True(Directory.Exists(path), "Required Application source is missing");
    foreach (var file in Directory.GetFiles(path, "*.cs", SearchOption.AllDirectories))
      Assert.DoesNotContain("IResumeRepository", File.ReadAllText(file));
  }

  [Fact]
  public void ApiLoggingCallsContainOnlyOperationalScalarFields()
  {
    var path = Path.Combine(Src, "ResumeBuilder.Api");
    Assert.True(Directory.Exists(path), "Required Api source is missing");
    var sources = ApiSources(path).Select(File.ReadAllText).ToArray();
    Assert.NotEmpty(sources);
    Assert.True(sources.Sum(source => Regex.Count(source, @"LoggerMessage\.Define\s*<")) > 0,
        "The guard must inspect the production LoggerMessage.Define templates");
    Assert.True(sources.Sum(source => Regex.Count(source, @"SafeLogs\.(?:Complete|Failure)\s*\(")) > 0,
        "The guard must inspect production SafeLogs call sites");
    Assert.All(sources, source => Assert.Empty(UnsafeLogArguments(source)));
  }

  [Fact]
  public void LoggingGuardRejectsContentTypedFields()
  {
    const string unsafeSample = "logger.LogError(error, \"{Resume} {Contact} {Photo} {RichText}\", resume, contact, photo, richText);";
    Assert.Equal(["Resume", "Contact", "Photo", "RichText"], UnsafeLogArguments(unsafeSample));
    Assert.Equal(["Contact"], UnsafeLogArguments("LoggerMessage.Define<string>(LogLevel.Error, new EventId(1), \"{Contact}\");"));
    Assert.Equal(["resume"], UnsafeLogArguments("SafeLogs.Failure(logger, resume, code, trace, route, status);"));
  }

  /// <summary>
  /// AC-P13-16, NFR-09: the backend talks only to its configured stores and SMTP, and the one processor ADR-055 §4 and
  /// ADR-012 Amendment 1 add: the Anthropic adapter of CV import, named here so no other file can call a third party.
  /// </summary>
  [Fact]
  public void BackendHasNoOutboundHttpClient()
  {
    var sources = ApiSources(Src).ToArray();
    Assert.NotEmpty(sources);
    var outbound = sources.Where(file => Regex.IsMatch(File.ReadAllText(file), @"\b(HttpClient|IHttpClientFactory|AddHttpClient|WebRequest|HttpWebRequest|WebClient)\b"))
        .Select(file => Path.GetFileName(file)!).ToArray();
    Assert.Equal(["AnthropicImportStructurer.cs"], outbound);
  }

  private static string Project(string layer) => Path.Combine(Src, $"ResumeBuilder.{layer}", $"ResumeBuilder.{layer}.csproj");
  private static string[] ForbiddenEdges(string layer, IEnumerable<string> actual, IEnumerable<string> allowed) => actual.Except(allowed).Select(x => $"{layer} -> {x}").ToArray();
  private static IEnumerable<string> ApiSources(string path) =>
      Directory.GetFiles(path, "*.cs", SearchOption.AllDirectories)
          .Where(file => !file.Split(Path.DirectorySeparatorChar).Any(part => part is "obj" or "bin"));

  private static string[] UnsafeLogArguments(string source)
  {
    var calls = Regex.Matches(source, @"\b(?:LogTrace|LogDebug|LogInformation|LogWarning|LogError|LogCritical|LoggerMessage\.Define(?:<[^>]+>)?|SafeLogs\.(?:Complete|Failure|ClientEvent))\s*\([^;]*;", RegexOptions.Singleline);
    return calls.SelectMany(call =>
    {
      var templateFields = Regex.Matches(call.Value, @"\{([A-Za-z][A-Za-z0-9]*)(?:[:}]|\b)")
              .Select(field => field.Groups[1].Value)
              .Where(field => !OperationalFields.Contains(field));
      var unsafeArguments = Regex.Matches(call.Value, @"\b(resume|richText|contact|photo)(?:Body|Bytes|Data)?\b", RegexOptions.IgnoreCase)
              .Select(argument => argument.Value);
      return templateFields.Any() ? templateFields : unsafeArguments;
    }).Distinct().ToArray();
  }
}
