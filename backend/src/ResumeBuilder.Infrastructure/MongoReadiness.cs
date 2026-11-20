using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application;

namespace ResumeBuilder.Infrastructure;

public sealed class MongoReadiness(string connectionString) : IReadinessProbe, IDisposable
{
  private readonly SemaphoreSlim gate = new(1, 1);
  private DateTimeOffset validUntil;
  private bool lastResult;

  public void Dispose() => gate.Dispose();

  public async Task<bool> IsReadyAsync(CancellationToken cancellationToken)
  {
    await gate.WaitAsync(cancellationToken);
    try
    {
      if (DateTimeOffset.UtcNow < validUntil) return lastResult;
      try
      {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(2));
        var client = new MongoClient(connectionString);
        await client.GetDatabase("admin").RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1), cancellationToken: timeout.Token);
        lastResult = true;
      }
      catch (Exception) when (!cancellationToken.IsCancellationRequested) { lastResult = false; }
      validUntil = DateTimeOffset.UtcNow.AddSeconds(5);
      return lastResult;
    }
    finally { gate.Release(); }
  }
}
