namespace ResumeBuilder.Application;

public interface IReadinessProbe
{
  Task<bool> IsReadyAsync(CancellationToken cancellationToken);
}
