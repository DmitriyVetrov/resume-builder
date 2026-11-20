using ResumeBuilder.Infrastructure;

namespace ResumeBuilder.Api;

/// <summary>DD-P13-04: operator commands run by the API binary instead of serving traffic.</summary>
public static class OperationsCommand
{
  public const string ReconcileRestore = "reconcile-restore";

  /// <summary>The process exit code, or null when the arguments name no command and the host should serve.</summary>
  public static async Task<int?> TryRunAsync(IServiceProvider services, string[] args, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(args);
    if (args.Length == 0 || args[0] != ReconcileRestore) return null;
    try
    {
      // The summary is logged by the reconciliation itself, with counts only.
      await services.GetRequiredService<RestoreReconciliation>().RunAsync(cancellationToken);
      return 0;
    }
    catch (Exception error) when (error is not OperationCanceledException)
    {
      SafeLogs.Failure(services.GetRequiredService<ILoggerFactory>().CreateLogger("ResumeBuilder.Api"), "restore_reconciliation_failed", "internal_error", "-", ReconcileRestore, 1);
      return 1;
    }
  }
}
