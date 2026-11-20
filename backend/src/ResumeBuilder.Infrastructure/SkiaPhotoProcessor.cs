using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;
using SkiaSharp;

namespace ResumeBuilder.Infrastructure;

/// <summary>
/// ADR-009 §8 and T-TA-04. The image is decoded to pixels and encoded again, so metadata and trailing bytes cannot
/// survive. Dimensions are checked from the header before any pixel is allocated.
/// </summary>
public sealed class SkiaPhotoProcessor : IPhotoProcessor
{
  private const int JpegMasterQuality = 92;
  private const int WebpMasterQuality = 90;
  private const int RenditionQuality = 90;
  private static readonly TimeSpan DecodeTimeout = TimeSpan.FromSeconds(10);

  public PhotoFormat? Detect(ReadOnlySpan<byte> upload)
  {
    if (upload.Length >= 3 && upload[0] == 0xFF && upload[1] == 0xD8 && upload[2] == 0xFF) return PhotoFormat.Jpeg;
    if (upload.StartsWith<byte>([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return PhotoFormat.Png;
    if (upload.Length >= 12 && upload[..4].SequenceEqual("RIFF"u8) && upload[8..12].SequenceEqual("WEBP"u8)) return PhotoFormat.Webp;
    return null;
  }

  public async Task<ProcessedMaster?> NormalizeAsync(byte[] upload, PhotoFormat format, CancellationToken cancellationToken)
  {
    // A hostile image must not hold the request: on timeout the answer is `photo_invalid` and the decode ends by itself.
    try { return await Task.Run(() => Normalize(upload, format), cancellationToken).WaitAsync(DecodeTimeout, cancellationToken); }
    catch (TimeoutException) { return null; }
  }

  private static ProcessedMaster? Normalize(byte[] upload, PhotoFormat format)
  {
    using var data = SKData.CreateCopy(upload);
    using var codec = SKCodec.Create(data);
    if (codec is null || codec.EncodedFormat != Encoded(format)) return null;
    var (width, height) = (codec.Info.Width, codec.Info.Height);
    if (width < 1 || height < 1 || width > ResumeLimits.MaxPhotoSide || height > ResumeLimits.MaxPhotoSide) return null;
    if ((long)width * height > ResumeLimits.MaxPhotoPixels) return null;

    var alpha = format == PhotoFormat.Jpeg ? SKAlphaType.Opaque : SKAlphaType.Premul;
    using var decoded = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, alpha));
    if (codec.GetPixels(decoded.Info, decoded.GetPixels()) != SKCodecResult.Success) return null;
    using var oriented = Orient(decoded, codec.EncodedOrigin);
    using var image = SKImage.FromBitmap(oriented);
    using var encoded = image.Encode(Encoded(format), format switch { PhotoFormat.Jpeg => JpegMasterQuality, PhotoFormat.Webp => WebpMasterQuality, _ => 100 });
    return encoded is null ? null : new ProcessedMaster(encoded.ToArray(), Mime(format), oriented.Width, oriented.Height);
  }

  public async Task<byte[]> RenderCropAsync(byte[] master, PhotoCrop crop, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(crop);
    return await Task.Run(() => RenderCrop(master, crop), cancellationToken).WaitAsync(DecodeTimeout, cancellationToken);
  }

  private static byte[] RenderCrop(byte[] master, PhotoCrop crop)
  {
    using var bitmap = SKBitmap.Decode(master) ?? throw new InvalidOperationException("The stored photo master cannot be decoded");
    using var source = SKImage.FromBitmap(bitmap);
    // Never upscaled (DD-P07-06), and flattened on white because JPEG has no alpha.
    var side = Math.Min(crop.Width, ResumeLimits.RenditionSide);
    using var surface = SKSurface.Create(new SKImageInfo(side, side, SKColorType.Rgba8888, SKAlphaType.Premul));
    surface.Canvas.Clear(SKColors.White);
    surface.Canvas.DrawImage(source, new SKRect(crop.X, crop.Y, crop.X + crop.Width, crop.Y + crop.Height), new SKRect(0, 0, side, side), new SKSamplingOptions(SKCubicResampler.Mitchell));
    using var rendered = surface.Snapshot();
    using var encoded = rendered.Encode(SKEncodedImageFormat.Jpeg, RenditionQuality);
    return encoded.ToArray();
  }

  /// <summary>Applies the EXIF orientation to the pixels, because the re-encoded file has no EXIF left to carry it.</summary>
  private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
  {
    var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
    var (width, height) = swap ? (source.Height, source.Width) : (source.Width, source.Height);
    var target = new SKBitmap(new SKImageInfo(width, height, source.ColorType, source.AlphaType));
    using var canvas = new SKCanvas(target);
    canvas.Clear(SKColors.Transparent);
    switch (origin)
    {
      case SKEncodedOrigin.TopRight: canvas.Translate(width, 0); canvas.Scale(-1, 1); break;
      case SKEncodedOrigin.BottomRight: canvas.Translate(width, height); canvas.RotateDegrees(180); break;
      case SKEncodedOrigin.BottomLeft: canvas.Translate(0, height); canvas.Scale(1, -1); break;
      case SKEncodedOrigin.LeftTop: canvas.RotateDegrees(90); canvas.Scale(1, -1); break;
      case SKEncodedOrigin.RightTop: canvas.Translate(width, 0); canvas.RotateDegrees(90); break;
      case SKEncodedOrigin.RightBottom: canvas.Translate(width, height); canvas.RotateDegrees(-90); canvas.Scale(1, -1); break;
      case SKEncodedOrigin.LeftBottom: canvas.Translate(0, height); canvas.RotateDegrees(-90); break;
      default: break;
    }
    using var image = SKImage.FromBitmap(source);
    canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest));
    return target;
  }

  private static SKEncodedImageFormat Encoded(PhotoFormat format) => format switch
  {
    PhotoFormat.Jpeg => SKEncodedImageFormat.Jpeg,
    PhotoFormat.Png => SKEncodedImageFormat.Png,
    _ => SKEncodedImageFormat.Webp,
  };

  private static string Mime(PhotoFormat format) => format switch
  {
    PhotoFormat.Jpeg => "image/jpeg",
    PhotoFormat.Png => "image/png",
    _ => "image/webp",
  };
}
