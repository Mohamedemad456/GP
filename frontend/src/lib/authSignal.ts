/**
 * Tiny pub/sub so api.ts can trigger a sign-out without importing React context
 * (which would create a circular dependency).
 */
let _handler: (() => void) | null = null;

export function registerAuthFailureHandler(fn: () => void): void {
  _handler = fn;
}

export function triggerAuthFailure(): void {
  _handler?.();
}
