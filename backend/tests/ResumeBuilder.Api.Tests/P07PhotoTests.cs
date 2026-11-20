using System.Net.Http.Headers;
using Azure.Storage.Blobs.Models;
using ResumeBuilder.Domain.Resumes;
using SkiaSharp;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>The media pipeline over HTTP, with the real codec and Azurite (AC-P07-11).</summary>
[Collection("P07")]
public sealed class P07PhotoTests(P07Containers containers)
{
  private static string Master(P07Created resume) => resume.Path + "/photo/master";
  private static string Rendition(P07Created resume) => resume.Path + "/photo/rendition";

  [Theory]
  [InlineData("jpeg", "image/jpeg")]
  [InlineData("png", "image/png")]
  [InlineData("webp", "image/webp")]
  public async Task P01EachFormatIsDetectedFromItsBytesWhateverThePartClaims(string format, string mime)
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var bytes = format switch { "jpeg" => P07Images.Jpeg(120, 90), "png" => P07Images.Png(120, 90), _ => P07Images.Webp(120, 90) };

    var uploaded = await user.Upload(resume.Id, bytes, resume.ETag, declaredType: "text/html");
    Assert.Equal(200, uploaded.Code);
    uploaded.AssertValid("PhotoWriteResult");
    Assert.Equal("\"2\"", uploaded.ETag);
    Assert.Equal("no-store", uploaded.CacheControl);
    Assert.Equal(mime, uploaded.Json["photo"]!["mime"]!.ToString());
    Assert.Equal(120, uploaded.Json["photo"]!["width"]!.GetValue<int>());
    Assert.Equal(90, uploaded.Json["photo"]!["height"]!.GetValue<int>());
    // The largest centred square.
    Assert.Equal(15, uploaded.Json["photo"]!["crop"]!["x"]!.GetValue<int>());
    Assert.Equal(0, uploaded.Json["photo"]!["crop"]!["y"]!.GetValue<int>());
    Assert.Equal(90, uploaded.Json["photo"]!["crop"]!["width"]!.GetValue<int>());
    Assert.Equal(90, uploaded.Json["photo"]!["crop"]!["height"]!.GetValue<int>());

    var master = await user.Get(Master(resume));
    Assert.Equal(200, master.Code);
    Assert.Equal(mime, master.ContentType);
    Assert.Equal(uploaded.Json["photo"]!["bytes"]!.GetValue<long>(), master.Bytes.Length);
    Assert.Equal((120, 90), P07Images.Size(master.Bytes));

    var photoInResume = (await user.Get(resume.Path)).Json["photo"]!;
    Assert.Equal(uploaded.Json["photo"]!["id"]!.ToString(), photoInResume["id"]!.ToString());
  }

  [Fact]
  public async Task P02ExifAndGpsAreAbsentFromMasterAndRendition()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var fixture = P07Images.WithExif(P07Images.Jpeg(64, 64));
    Assert.True(P07Images.Contains(fixture, "P07GPSMARKER"), "The fixture must carry the marker");
    var resume = await user.WithPhoto(fixture);
    foreach (var path in new[] { Master(resume), Rendition(resume) })
    {
      var image = await user.Get(path);
      Assert.Equal(200, image.Code);
      Assert.False(P07Images.Contains(image.Bytes, "P07GPSMARKER"), "Metadata survived in " + path);
      Assert.False(P07Images.Contains(image.Bytes, "Exif"), "EXIF survived in " + path);
    }
  }

  [Fact]
  public async Task P03OrientationIsAppliedToThePixels()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    // Orientation 6: display rotated 90° clockwise, so the red left half becomes the top half.
    var resume = await user.WithPhoto(P07Images.WithExif(P07Images.TwoColourJpeg(80, 40), orientation: 6));
    var photo = (await user.Get(resume.Path)).Json["photo"]!;
    Assert.Equal(40, photo["width"]!.GetValue<int>());
    Assert.Equal(80, photo["height"]!.GetValue<int>());
    var master = (await user.Get(Master(resume))).Bytes;
    Assert.Equal((40, 80), P07Images.Size(master));
    Assert.True(P07Images.Pixel(master, 20, 10).Red > 200, "The top of the normalised image must be red");
    Assert.True(P07Images.Pixel(master, 20, 70).Blue > 200, "The bottom of the normalised image must be blue");
  }

  [Fact]
  public async Task P04RenditionIsASquareJpegAtMostSixHundredPixelsNeverUpscaledAndFlattenedOnWhite()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();

    var large = await user.WithPhoto(P07Images.Png(1200, 900));
    var rendition = await user.Get(Rendition(large));
    Assert.Equal(200, rendition.Code);
    Assert.Equal("image/jpeg", rendition.ContentType);
    Assert.Equal((ResumeLimits.RenditionSide, ResumeLimits.RenditionSide), P07Images.Size(rendition.Bytes));

    var small = await user.WithPhoto(P07Images.Png(100, 200));
    Assert.Equal((100, 100), P07Images.Size((await user.Get(Rendition(small))).Bytes));

    var transparent = await user.WithPhoto(P07Images.TransparentPng(50, 50));
    var flattened = P07Images.Pixel((await user.Get(Rendition(transparent))).Bytes, 25, 25);
    Assert.True(flattened.Red > 245 && flattened.Green > 245 && flattened.Blue > 245, "Transparency must be flattened on white");
    Assert.Equal(0, P07Images.Pixel((await user.Get(Master(transparent))).Bytes, 25, 25).Alpha);
  }

  [Fact]
  public async Task P05CropRegeneratesTheRenditionOnlyAndKeepsTheMasterBytes()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto(P07Images.TwoColourJpeg(200, 100));
    var masterBefore = (await user.Get(Master(resume))).Bytes;

    // The left square of the two-colour fixture is entirely red.
    var cropped = await user.Crop(resume.Id, 0, 0, 100, 100, resume.ETag);
    Assert.Equal(200, cropped.Code);
    cropped.AssertValid("PhotoWriteResult");
    Assert.Equal("\"3\"", cropped.ETag);
    Assert.Equal(0, cropped.Json["photo"]!["crop"]!["x"]!.GetValue<int>());
    Assert.Equal(resume.Json["photo"]!["id"]!.ToString(), cropped.Json["photo"]!["id"]!.ToString());

    Assert.Equal(masterBefore, (await user.Get(Master(resume))).Bytes);
    var rendition = (await user.Get(Rendition(resume))).Bytes;
    Assert.Equal((100, 100), P07Images.Size(rendition));
    Assert.True(P07Images.Pixel(rendition, 90, 50).Red > 200, "The crop must come from the requested rectangle");
    Assert.True(P07Images.Pixel(rendition, 90, 50).Blue < 60, "The crop must not reach the blue half");
  }

  [Fact]
  public async Task P06ImageReadsCarryPrivateCachingAndAnswer304AndWorkWhenTrashed()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto(P07Images.Png(30, 30));
    foreach (var path in new[] { Master(resume), Rendition(resume) })
    {
      var image = await user.Get(path);
      Assert.Equal(200, image.Code);
      Assert.Equal("private, no-cache", image.CacheControl);
      Assert.Contains("nosniff", image.Headers.GetValues("X-Content-Type-Options"));
      Assert.Matches("^\"[A-Za-z0-9_-]{1,64}\"$", image.ETag!);
      var revalidated = await user.Get(path, image.ETag);
      Assert.Equal(304, revalidated.Code);
      Assert.Empty(revalidated.Bytes);
      Assert.Equal(image.ETag, revalidated.ETag);
      Assert.Equal("private, no-cache", revalidated.CacheControl);
      Assert.Equal(200, (await user.Get(path, "\"other\"")).Code);
    }
    var trashed = await user.Trash(resume.Id, resume.ETag);
    Assert.Equal(200, trashed.Code);
    Assert.Equal(200, (await user.Get(Rendition(resume))).Code);
    Assert.Equal(200, (await user.Get(Master(resume))).Code);
  }

  [Fact]
  public async Task P07ACopyOwnsIndependentBlobs()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var source = await user.WithPhoto(P07Images.Png(30, 30));
    var masterBytes = (await user.Get(Master(source))).Bytes;

    var copy = await user.Copy(source.Id);
    Assert.Equal(201, copy.Code);
    copy.AssertValid("Resume");
    var copied = new P07Created(Guid.Parse(copy.Json["id"]!.ToString()), copy.ETag!, copy.Json);
    var photoId = copy.Json["photo"]!["id"]!.ToString();
    Assert.NotEqual(source.Json["photo"]!["id"]!.ToString(), photoId);
    Assert.Equal(4, (await containers.PhotoKeys(user.Id)).Length);

    Assert.Equal(200, (await user.RemovePhoto(source.Id, source.ETag)).Code);
    (await user.Get(Master(source))).AssertProblem(404, "not_found");
    Assert.Equal(masterBytes, (await user.Get(Master(copied))).Bytes);
    Assert.Equal(new[] { $"u/{user.Id}/p/{photoId}/master", $"u/{user.Id}/p/{photoId}/rendition" }, await containers.PhotoKeys(user.Id));
  }

  [Fact]
  public async Task P08UnusableUploadsAreRejectedAtTheirContractStage()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var photo = resume.Path + "/photo";
    var key = P07User.NewKey;

    // Wrong magic is the syntax stage, even when the part claims to be an image.
    (await user.Upload(resume.Id, "GIF89a-not-accepted"u8.ToArray(), resume.ETag, declaredType: "image/jpeg")).AssertProblem(415, "unsupported_media_type");
    using var json = P07User.Json("{}");
    (await user.Send(HttpMethod.Post, photo, json, resume.ETag, key())).AssertProblem(415, "unsupported_media_type");

    // Undecodable or over the dimension limits is the domain stage.
    (await user.Upload(resume.Id, [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x01, 0x02, 0x03], resume.ETag)).AssertProblem(400, "photo_invalid");
    (await user.Upload(resume.Id, P07Images.GrayPng(ResumeLimits.MaxPhotoSide + 1, 1), resume.ETag)).AssertProblem(400, "photo_invalid");
    (await user.Upload(resume.Id, P07Images.GrayPng(6400, 6400), resume.ETag)).AssertProblem(400, "photo_invalid");
    Assert.Equal(1, await user.CurrentVersion(resume.Id));

    // Sizes count 1 048 576 bytes per MB. The file bound is exact, and a valid image padded to it still works.
    var padded = P07Images.Png(10, 10);
    padded = [.. padded, .. new byte[ResumeLimits.MaxPhotoFileBytes - padded.Length]];
    var atBound = await user.Upload(resume.Id, padded, resume.ETag);
    Assert.Equal(200, atBound.Code);
    (await user.Upload(resume.Id, [.. padded, 0], atBound.ETag)).AssertProblem(413, "payload_too_large");
    (await user.Upload(resume.Id, new byte[ResumeLimits.MaxPhotoBodyBytes + 1], atBound.ETag)).AssertProblem(413, "payload_too_large");

    // Exactly one part named `file`.
    using var wrongName = P07User.PhotoForm(P07Images.Png(10, 10), partName: "image");
    (await user.Send(HttpMethod.Post, photo, wrongName, atBound.ETag, key())).AssertIssue("body", "/file", "required");
    using var two = P07User.PhotoForm(P07Images.Png(10, 10));
    two.Add(new ByteArrayContent(P07Images.Png(10, 10)), "extra", "extra.bin");
    (await user.Send(HttpMethod.Post, photo, two, atBound.ETag, key())).AssertIssue("body", "", "unknown_property");
    Assert.Equal(2, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public async Task P09TrailingPolyglotBytesAreGone()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto([.. P07Images.Jpeg(40, 40), .. "<script>P07POLYGLOT</script>"u8.ToArray()]);
    foreach (var path in new[] { Master(resume), Rendition(resume) })
      Assert.False(P07Images.Contains((await user.Get(path)).Bytes, "P07POLYGLOT"), "Trailing bytes survived in " + path);
  }

  [Fact]
  public async Task P10InvalidCropsAreRejectedAndWithoutAPhotoCropIs404()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto(P07Images.Png(100, 50));
    (await user.Crop(resume.Id, 0, 0, 20, 30, resume.ETag)).AssertIssue("body", "/height", "crop_not_square");
    (await user.Crop(resume.Id, 90, 0, 20, 20, resume.ETag)).AssertIssue("body", "/width", "crop_out_of_bounds");
    (await user.Crop(resume.Id, 0, 40, 20, 20, resume.ETag)).AssertIssue("body", "/height", "crop_out_of_bounds");
    (await user.Send(HttpMethod.Put, resume.Path + "/photo/crop", P07User.Json("{\"x\":0,\"y\":0,\"width\":0,\"height\":0}"), resume.ETag, P07User.NewKey())).AssertIssue("body", "/width", "minimum");
    (await user.Send(HttpMethod.Put, resume.Path + "/photo/crop", P07User.Json("{\"x\":0,\"y\":0,\"width\":10,\"height\":10,\"z\":1}"), resume.ETag, P07User.NewKey())).AssertIssue("body", "", "unknown_property");
    Assert.Equal(2, await user.CurrentVersion(resume.Id));

    var without = await user.Created();
    (await user.Crop(without.Id, 0, 0, 10, 10, without.ETag)).AssertProblem(404, "not_found");
    (await user.Get(without.Path + "/photo/master")).AssertProblem(404, "not_found");
    (await user.Get(without.Path + "/photo/rendition")).AssertProblem(404, "not_found");
  }

  [Fact]
  public async Task P11RemovingAMissingPhotoIs404AndKeepsTheVersion()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    (await user.RemovePhoto(resume.Id, resume.ETag)).AssertProblem(404, "not_found");
    Assert.Equal(1, await user.CurrentVersion(resume.Id));
  }

  /// <summary>I04: the hash covers the file bytes only, so a retry with another multipart boundary replays.</summary>
  [Fact]
  public async Task I04MultipartRetryWithANewBoundaryReplays()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var bytes = P07Images.Png(20, 20);
    var key = P07User.NewKey();
    var path = resume.Path + "/photo";

    static MultipartFormDataContent Form(byte[] image, string boundary)
    {
      var form = new MultipartFormDataContent(boundary);
      var part = new ByteArrayContent(image);
      part.Headers.ContentType = new MediaTypeHeaderValue("image/png");
      form.Add(part, "file", "any-name.png");
      return form;
    }
    using var firstForm = Form(bytes, "boundary-one");
    var first = await user.Send(HttpMethod.Post, path, firstForm, resume.ETag, key);
    Assert.Equal(200, first.Code);
    using var retryForm = Form(bytes, "boundary-two-is-different");
    var retry = await user.Send(HttpMethod.Post, path, retryForm, resume.ETag, key);
    Assert.Equal(200, retry.Code);
    Assert.Equal(first.ETag, retry.ETag);
    Assert.Equal(first.Json["photo"]!["id"]!.ToString(), retry.Json["photo"]!["id"]!.ToString());
    Assert.Equal(2, await user.CurrentVersion(resume.Id));
    Assert.Equal(2, (await containers.PhotoKeys(user.Id)).Length);
  }
}
