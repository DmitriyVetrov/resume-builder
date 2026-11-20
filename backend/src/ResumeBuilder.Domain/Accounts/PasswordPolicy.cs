using System.Collections.Frozen;
using System.Reflection;
using System.Text;

namespace ResumeBuilder.Domain.Accounts;

public static class PasswordPolicy
{
  private const int MinimumRunes = 10;
  private const int MaximumRunes = 128;
  private const int ShortestLookup = 4;

  /// <summary>Keyboard, alphabet and digit runs; a password that is a slice of one of these is common.</summary>
  private static readonly string[] Sequences =
  [
    "1234567890", "0987654321", "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba",
    "qwertyuiop", "poiuytrewq", "asdfghjkl", "lkjhgfdsa", "zxcvbnm", "mnbvcxz"
  ];

  private static readonly (char Leet, char Plain)[] Substitutions =
  [
    ('0', 'o'), ('1', 'i'), ('3', 'e'), ('4', 'a'), ('5', 's'), ('7', 't'), ('8', 'b'),
    ('@', 'a'), ('$', 's'), ('!', 'i')
  ];

  private static readonly FrozenSet<string> Common = Load();

  public static string? Validate(string password)
  {
    var length = password.EnumerateRunes().Count();
    if (length < MinimumRunes) return "password_too_short";
    if (length > MaximumRunes) return "password_too_long";
    return IsCommon(password) ? "password_too_common" : null;
  }

  private static bool IsCommon(string password)
  {
    var lower = password.ToLowerInvariant();
    foreach (var form in new[] { lower, Deleet(lower) })
    {
      foreach (var candidate in Reductions(form))
      {
        if (Common.Contains(candidate)) return true;
      }
      if (IsSequenceSlice(Alphanumeric(form))) return true;
    }
    return false;
  }

  /// <summary>The password itself plus the reductions that strip the affixes commonly bolted onto a weak base word.</summary>
  private static IEnumerable<string> Reductions(string form)
  {
    var core = form.Trim(NotAlphanumeric(form));
    // A trailing letter run is stripped only when a pure digit run remains ("1234567890a"). Stripping it
    // unconditionally would decapitate hyphenated passphrases: "signup-password" would reduce to "signup".
    var withoutTrailingLetters = TrimEnd(core, char.IsAsciiLetter);
    foreach (var candidate in new[]
    {
      form,
      core,
      TrimEnd(core, char.IsAsciiDigit),
      withoutTrailingLetters.Length > 0 && withoutTrailingLetters.All(char.IsAsciiDigit) ? withoutTrailingLetters : core,
      TrimStart(core, char.IsAsciiDigit)
    })
    {
      var trimmed = candidate.Trim(NotAlphanumeric(candidate));
      if (trimmed.Length >= ShortestLookup) yield return trimmed;
    }
  }

  private static char[] NotAlphanumeric(string value) =>
    value.Where(c => !char.IsAsciiLetterOrDigit(c)).Distinct().ToArray();

  private static string TrimEnd(string value, Func<char, bool> drop)
  {
    var end = value.Length;
    while (end > 0 && drop(value[end - 1])) end--;
    return value[..end];
  }

  private static string TrimStart(string value, Func<char, bool> drop)
  {
    var start = 0;
    while (start < value.Length && drop(value[start])) start++;
    return value[start..];
  }

  private static string Deleet(string value)
  {
    var builder = new StringBuilder(value.Length);
    foreach (var c in value)
    {
      var replacement = c;
      foreach (var (leet, plain) in Substitutions)
      {
        if (c == leet) { replacement = plain; break; }
      }
      builder.Append(replacement);
    }
    return builder.ToString();
  }

  private static string Alphanumeric(string value) =>
    string.Concat(value.Where(char.IsAsciiLetterOrDigit));

  private static bool IsSequenceSlice(string value) =>
    value.Length >= 6 && Sequences.Any(sequence => sequence.Contains(value, StringComparison.Ordinal));

  private static FrozenSet<string> Load()
  {
    using var stream = typeof(PasswordPolicy).GetTypeInfo().Assembly
      .GetManifestResourceStream("ResumeBuilder.Domain.Accounts.common-passwords.txt")
      ?? throw new InvalidOperationException("The bundled common-password list is missing from the assembly.");
    using var reader = new StreamReader(stream, Encoding.UTF8);
    var entries = new HashSet<string>(StringComparer.Ordinal);
    while (reader.ReadLine() is string line)
    {
      var entry = line.Trim();
      if (entry.Length > 0 && !entry.StartsWith('#')) entries.Add(entry.ToLowerInvariant());
    }
    return entries.ToFrozenSet(StringComparer.Ordinal);
  }
}
