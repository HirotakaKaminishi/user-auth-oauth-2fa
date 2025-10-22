/**
 * Result type for functional error handling
 * Based on Rust's Result<T, E> pattern
 */

export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
});

export const Err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});

/**
 * Utility function to check if Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Utility function to check if Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Unwrap Result value or throw error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Attempted to unwrap an Err value: ${JSON.stringify(result.error)}`);
}

/**
 * Unwrap Result value or return default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue;
}
