using ResumeBuilder.Application.CvImport;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>IMP-01 V-01…V-10: the verbatim check that keeps X1 a property, not a promise (ADR-055 §5, DD-IMP-07).</summary>
public sealed class Imp01VerbatimTests
{
  private static VerbatimSource Source(string text) => new(text);

  [Fact]
  public void V01AnExactSubstringPasses() =>
    Assert.True(Source("[M] Built the platform for twelve teams.").HasText("the platform for twelve"));

  [Fact]
  public void V02DashQuoteAndWhitespaceVariantsPassAndAStringMaySpanLines()
  {
    Assert.True(Source("[S] B.Sc., 2017 – 2018").HasText("B.Sc., 2017 - 2018"));
    Assert.True(Source("[M] He said “ship it”").HasText("He said \"ship it\""));
    Assert.True(Source("[M] Ran the platform for twelve\n[M] teams across  two regions.").HasText("twelve teams across two regions."));
  }

  [Fact]
  public void V03InlineTagsAreIgnoredForTextOnBothSides()
  {
    var source = Source("[M li] Built <a href=\"https://example.com/\">example.com</a> <b>fast</b>.");
    Assert.True(source.HasText("Built example.com fast."));
    Assert.True(source.HasText("Built <a href=\"https://example.com/\">example.com</a> <i>fast</i>."));
  }

  [Fact]
  public void V04ASectionTitleMayComeBackInTitleCase() =>
    Assert.True(Source("[M b 11] WORK EXPERIENCE").HasText("Work Experience", ignoreCase: true));

  [Fact]
  public void V05InventedOrRewordedTextFails()
  {
    var source = Source("[M li] Built the release pipeline.");
    Assert.False(source.HasText("Built the deployment pipeline."));
    Assert.False(source.HasText("Designed the release pipeline."));
    Assert.False(source.HasText("Built the release pipeline. Led a team of five."));
  }

  [Fact]
  public void V06LinksMustComeFromTheSource()
  {
    var source = Source("[M] Built <a href=\"https://example.com/\">example.com</a>\n[S li] Portfolio: example.org/alex");
    Assert.True(source.HasHref("https://example.com/"));
    Assert.True(source.HasHref("https://example.org/alex"));
    Assert.False(source.HasHref("https://evil.example/"));
    Assert.False(source.HasHref("https://example.com/other"));
  }

  [Fact]
  public void V07DatesMustUseYearsAndMonthsFromTheSource()
  {
    var english = Source("[M b] Platform Engineer | Jan – May 2026");
    Assert.True(english.HasDate(2026, 1));
    Assert.True(english.HasDate(2026, 5));
    Assert.True(english.HasDate(2026, null));
    Assert.False(english.HasDate(2025, null));
    Assert.False(english.HasDate(2026, 3));
    Assert.True(Source("enero – mayo 2026").HasDate(2026, 5));
    Assert.True(Source("січ 2024 – тепер").HasDate(2024, 1));
    var numeric = Source("05/2021 - 03/2022");
    Assert.True(numeric.HasDate(2021, 5));
    Assert.True(numeric.HasDate(2022, 3));
    Assert.False(numeric.HasDate(2021, 7));
    Assert.False(Source("Room 2026B").HasDate(2026, null));
  }

  [Fact]
  public void V08CaseMattersOutsideSectionTitles() =>
    Assert.False(Source("[M] Built the release pipeline.").HasText("built the release pipeline."));

  [Fact]
  public void V09EmptyAndNullStringsPass()
  {
    Assert.True(Source("anything").HasText(""));
    Assert.True(Source("anything").HasText(null));
  }

  [Fact]
  public void V10CompatibilityFormsMatchTheirPlainForm()
  {
    Assert.True(Source("[M] Head of ﬁnance").HasText("Head of finance"));
    Assert.True(Source("[M] ＡＢＣ Systems").HasText("ABC Systems"));
  }
}
