namespace ResumeBuilder.Domain.Resumes;

/// <summary>NFR-12 and domain-model §6. Text lengths count Unicode code points.</summary>
public static class ResumeLimits
{
  public const int ResumesPerUser = 200;
  public const int Sections = 100;
  public const int Entries = 100;
  public const int ListItems = 100;
  public const int Contacts = 20;
  public const int TotalText = 50_000;
  public const int Title = 150;
  public const int FullName = 120;
  public const int Headline = 200;
  public const int ContactText = 200;
  public const int SectionTitle = 80;
  public const int EntryField = 150;
  public const int DateText = 60;
  public const int Label = 40;
  public const int Url = 2048;
  public const int MaxJsonDepth = 64;
  public const int MaxJsonBodyBytes = 1_048_576;
  public const int MaxPhotoFileBytes = 5 * 1_048_576;
  public const int MaxPhotoBodyBytes = 6 * 1_048_576;
  public const int MaxPhotoSide = 8000;
  public const long MaxPhotoPixels = 40_000_000;
  public const int RenditionSide = 600;
  public static readonly TimeSpan TrashRetention = TimeSpan.FromDays(30);
  public static readonly TimeSpan SnapshotRetention = TimeSpan.FromDays(30);
  public static readonly TimeSpan AutoSnapshotInterval = TimeSpan.FromMinutes(10);
}
