/** Errors raised at the data boundary. Routes catch these at their error boundary. */
export class DataError extends Error {
  override readonly name = 'DataError';
}
