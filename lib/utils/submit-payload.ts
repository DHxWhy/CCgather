const CLI_VERSION = /^[0-9A-Za-z.+-]{1,32}$/;

/**
 * The version a CLI says it is, as it may be logged, stored and shown to ops. A client can send
 * anything here, and a string the database refuses — one holding a NUL character, say — fails
 * every write it is part of, including the record that limits how often an alert goes out.
 */
export function readCliVersion(value: unknown): string {
  if (typeof value !== "string") return "pre-2.2.0";
  return CLI_VERSION.test(value) ? value : "invalid";
}

/** A count taken from the payload: a whole number from 0 up, and 0 for anything else. */
export function readDeclaredCount(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
