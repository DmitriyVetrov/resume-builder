using System.Buffers.Binary;
using System.Diagnostics;
using System.Text;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Hostile uploads beyond P07's fixtures (AC-P13-08, T-TA-04). GPS stripping is P07 P02.</summary>
[Collection("P13")]
public sealed class P13UploadAbuseTests(P07Containers containers)
{
  private static readonly TimeSpan Bound = TimeSpan.FromSeconds(2);

  private static uint Crc32(ReadOnlySpan<byte> data)
  {
    var crc = 0xFFFFFFFFu;
    foreach (var value in data)
    {
      crc ^= value;
      for (var bit = 0; bit < 8; bit++) crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
    }
    return ~crc;
  }

  /// <summary>A valid 1 × 1 PNG whose IHDR then claims other dimensions, with a correct chunk CRC.</summary>
  private static byte[] PngClaiming(int width, int height)
  {
    var png = P07Images.Png(1, 1);
    Assert.Equal("IHDR", Encoding.ASCII.GetString(png, 12, 4));
    BinaryPrimitives.WriteInt32BigEndian(png.AsSpan(16), width);
    BinaryPrimitives.WriteInt32BigEndian(png.AsSpan(20), height);
    BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(29), Crc32(png.AsSpan(12, 17)));
    return png;
  }

  /// <summary>A valid small JPEG whose SOF0 then claims other dimensions.</summary>
  private static byte[] JpegClaiming(ushort width, ushort height)
  {
    var jpeg = P07Images.Jpeg(8, 8);
    var sof = Enumerable.Range(2, jpeg.Length - 10).First(index => jpeg[index] == 0xFF && jpeg[index + 1] is 0xC0 or 0xC2);
    BinaryPrimitives.WriteUInt16BigEndian(jpeg.AsSpan(sof + 5), height);
    BinaryPrimitives.WriteUInt16BigEndian(jpeg.AsSpan(sof + 7), width);
    return jpeg;
  }

  private async Task Refused(byte[] bytes, int status, string code, string declaredType = "application/octet-stream")
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var clock = Stopwatch.StartNew();
    var response = await user.Upload(resume.Id, bytes, resume.ETag, declaredType: declaredType);
    clock.Stop();
    response.AssertProblem(status, code);
    Assert.True(clock.Elapsed < Bound, $"Refusing took {clock.Elapsed}");
    Assert.Empty(await containers.PhotoKeys(user.Id));
    Assert.Equal(1, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public Task U01APngClaiming65000PixelsASideIsRefusedFromItsHeader() => Refused(PngClaiming(65_000, 65_000), 400, "photo_invalid");

  [Fact]
  public Task U02AJpegClaiming65000PixelsASideIsRefusedFromItsHeader() => Refused(JpegClaiming(65_000, 65_000), 400, "photo_invalid");

  [Fact]
  public async Task U03TruncatedImagesAreRefused()
  {
    var png = P07Images.Png(200, 200);
    await Refused(png[..(png.Length / 2)], 400, "photo_invalid");
    var jpeg = P07Images.TwoColourJpeg(200, 200);
    await Refused(jpeg[..(jpeg.Length / 2)], 400, "photo_invalid");
  }

  [Fact]
  public async Task U04ScriptsDisguisedAsImagesAreRefusedByTheirBytes()
  {
    await Refused("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"u8.ToArray(), 415, "unsupported_media_type", "image/png");
    await Refused("<!doctype html><html><body><script>alert(1)</script></body></html>"u8.ToArray(), 415, "unsupported_media_type", "image/png");
  }

  [Fact]
  public async Task U05AnEmptyFileIsRefusedAndStoresNothing()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var response = await user.Upload(resume.Id, [], resume.ETag, declaredType: "image/png");
    Assert.True(response.Code is 400 or 415, $"An empty file answered {response.Code}");
    Assert.Equal("application/problem+json", response.ContentType);
    Assert.Empty(await containers.PhotoKeys(user.Id));
    Assert.Equal(1, await user.CurrentVersion(resume.Id));
  }
}
