using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using ResumeBuilder.Application.Accounts;

namespace ResumeBuilder.Infrastructure;

public sealed class AccountTimeProvider(IClock clock) : TimeProvider
{
  public override DateTimeOffset GetUtcNow() => clock.UtcNow;
}

public sealed class AccountCookieTicketStore(ISessionStore sessions, IAccountStore accounts, IClock clock) : ITicketStore
{
  public const string SessionClaim = "rb:session";
  public static ClaimsPrincipal Principal(Guid sessionId, Guid accountId) => new(new ClaimsIdentity(
    [new Claim(ClaimTypes.NameIdentifier, accountId.ToString()), new Claim(SessionClaim, sessionId.ToString())], CookieAuthenticationDefaults.AuthenticationScheme));

  public Task<string> StoreAsync(AuthenticationTicket ticket) => Task.FromResult(ticket.Principal.FindFirstValue(SessionClaim) ?? throw new InvalidOperationException("Session reference missing"));
  public Task RenewAsync(string key, AuthenticationTicket ticket) => RenewAsync(key, ticket, CancellationToken.None);
  public async Task RenewAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken)
  {
    if (!Guid.TryParse(key, out var id)) return;
    var session = await sessions.FindActiveAsync(id, clock.UtcNow, cancellationToken);
    if (session is null) return;
    var expires = clock.UtcNow.AddDays(14);
    if (expires > session.AbsoluteExpiresAt) expires = session.AbsoluteExpiresAt;
    await sessions.RenewAsync(id, clock.UtcNow, expires, cancellationToken);
  }
  public Task<AuthenticationTicket?> RetrieveAsync(string key) => RetrieveAsync(key, CancellationToken.None);
  public async Task<AuthenticationTicket?> RetrieveAsync(string key, CancellationToken cancellationToken)
  {
    if (!Guid.TryParse(key, out var id)) return null;
    var session = await sessions.FindActiveAsync(id, clock.UtcNow, cancellationToken);
    if (session is null) return null;
    var account = await accounts.FindByIdAsync(session.AccountId, cancellationToken);
    if (account is null || account.DeletionRequestedAt is not null) return null;
    return new AuthenticationTicket(Principal(session.Id, account.Id), new AuthenticationProperties
    {
      IssuedUtc = session.LastSeenAt,
      ExpiresUtc = session.ExpiresAt,
      IsPersistent = true,
      AllowRefresh = true
    }, CookieAuthenticationDefaults.AuthenticationScheme);
  }
  public Task RemoveAsync(string key) => RemoveAsync(key, CancellationToken.None);
  public Task RemoveAsync(string key, CancellationToken cancellationToken) => Guid.TryParse(key, out var id) ? sessions.RevokeAsync(id, cancellationToken) : Task.CompletedTask;
}
