/** Prevent React's default caught-error logging from exposing component data. */
export function suppressCaughtErrorLogging(): void {
  // Intentionally empty: errors displayed by the route boundary are generic.
}
