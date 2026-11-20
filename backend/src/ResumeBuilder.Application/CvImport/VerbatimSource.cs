using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ResumeBuilder.Application.CvImport;

/// <summary>
/// ADR-055 §5 and DD-IMP-07: whether a draft string, link or date comes from the source text. Both sides are
/// normalised the same way (NFKC, one dash, straight quotes, single spaces, the three inline tags removed), and
/// the source's line tags and line breaks are dropped, so a string may span wrapped lines.
/// </summary>
public sealed partial class VerbatimSource
{
  private static readonly string[][] MonthWords =
  [
    ["jan", "january", "ene", "enero", "січ", "січень", "січня"],
    ["feb", "february", "febrero", "лют", "лютий", "лютого"],
    ["mar", "march", "marzo", "бер", "березень", "березня"],
    ["apr", "april", "abr", "abril", "кві", "квіт", "квітень", "квітня"],
    ["may", "mayo", "тра", "трав", "травень", "травня"],
    ["jun", "june", "junio", "чер", "черв", "червень", "червня"],
    ["jul", "july", "julio", "лип", "липень", "липня"],
    ["aug", "august", "ago", "agosto", "сер", "серп", "серпень", "серпня"],
    ["sep", "sept", "september", "set", "septiembre", "setiembre", "вер", "вересень", "вересня"],
    ["oct", "october", "octubre", "жов", "жовт", "жовтень", "жовтня"],
    ["nov", "november", "noviembre", "лис", "лист", "листопад", "листопада"],
    ["dec", "december", "dic", "diciembre", "гру", "груд", "грудень", "грудня"],
  ];

  private readonly string text;
  private readonly string folded;
  private readonly HashSet<string> hrefs = new(StringComparer.Ordinal);
  private readonly HashSet<int> years = [];
  private readonly HashSet<int> months = [];

  public VerbatimSource(string source)
  {
    ArgumentNullException.ThrowIfNull(source);
    var lines = LineTag().Replace(source, "");
    foreach (Match match in Href().Matches(lines)) hrefs.Add(match.Groups[1].Value);
    text = Normalize(lines);
    folded = text.ToLowerInvariant();
    foreach (Match match in Year().Matches(text)) years.Add(int.Parse(match.Value, CultureInfo.InvariantCulture));
    foreach (Match match in NumericMonth().Matches(text))
    {
      var value = match.Groups["before"].Success ? match.Groups["before"].Value : match.Groups["after"].Value;
      months.Add(int.Parse(value, CultureInfo.InvariantCulture));
    }
    var words = Word().Matches(folded).Select(match => match.Value).ToHashSet(StringComparer.Ordinal);
    for (var index = 0; index < MonthWords.Length; index++)
      if (MonthWords[index].Any(words.Contains)) months.Add(index + 1);
  }

  /// <summary>The comparison form: NFKC, `-` for every dash, straight quotes, single spaces, no inline tags.</summary>
  public static string Normalize(string value)
  {
    ArgumentNullException.ThrowIfNull(value);
    var composed = InlineTag().Replace(value, "").Normalize(NormalizationForm.FormKC);
    var builder = new StringBuilder(composed.Length);
    foreach (var c in composed)
      builder.Append(c switch
      {
        '‐' or '‑' or '‒' or '–' or '—' or '―' or '−' => '-',
        '‘' or '’' or '‚' or '‛' or '′' => '\'',
        '“' or '”' or '„' or '‟' or '″' => '"',
        _ => char.IsWhiteSpace(c) ? ' ' : c,
      });
    return Spaces().Replace(builder.ToString(), " ").Trim();
  }

  /// <summary>Section titles compare case-insensitively (a title may come back in title case); everything else exactly.</summary>
  public bool HasText(string? value, bool ignoreCase = false)
  {
    if (string.IsNullOrEmpty(value)) return true;
    var normal = Normalize(value);
    if (normal.Length == 0) return true;
    return ignoreCase ? folded.Contains(normal.ToLowerInvariant(), StringComparison.Ordinal) : text.Contains(normal, StringComparison.Ordinal);
  }

  /// <summary>A link target from an `href` in the source, or whose address without its scheme appears in the source text.</summary>
  public bool HasHref(string url)
  {
    ArgumentNullException.ThrowIfNull(url);
    if (hrefs.Contains(url)) return true;
    var bare = Scheme().Replace(url.Trim(), "").TrimEnd('/');
    return bare.Length > 0 && folded.Contains(bare.ToLowerInvariant(), StringComparison.Ordinal);
  }

  /// <summary>The year occurs as a standalone four-digit number; the month as a number next to a year or as a month word.</summary>
  public bool HasDate(int year, int? month) => years.Contains(year) && (month is null || months.Contains(month.Value));

  [GeneratedRegex(@"(?m)^\[[^\]\r\n]{1,40}\][ \t]?", RegexOptions.CultureInvariant)]
  private static partial Regex LineTag();
  [GeneratedRegex("<a href=\"([^\"]*)\">", RegexOptions.CultureInvariant)]
  private static partial Regex Href();
  [GeneratedRegex("</?(?:b|i|a)(?: href=\"[^\"]*\")?>", RegexOptions.CultureInvariant)]
  private static partial Regex InlineTag();
  [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant)]
  private static partial Regex Spaces();
  [GeneratedRegex(@"(?<![\p{L}\p{N}])\d{4}(?![\p{L}\p{N}])", RegexOptions.CultureInvariant)]
  private static partial Regex Year();
  [GeneratedRegex(@"(?<!\d)(?<before>0?[1-9]|1[0-2])[./-]\d{4}(?!\d)|(?<!\d)\d{4}[./-](?<after>0?[1-9]|1[0-2])(?!\d)", RegexOptions.CultureInvariant)]
  private static partial Regex NumericMonth();
  [GeneratedRegex(@"\p{L}+", RegexOptions.CultureInvariant)]
  private static partial Regex Word();
  [GeneratedRegex("^(?:https?://|mailto:|tel:)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
  private static partial Regex Scheme();
}
