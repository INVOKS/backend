/**
 * Helper untuk mendeteksi error duplikasi kunci (unique constraint violation)
 * dari MariaDB / MySQL (ER_DUP_ENTRY / errno 1062), baik pada objek error langsung
 * maupun pada property cause (DrizzleQueryError 0.45.x).
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const anyErr = err as Record<string, unknown>;

  if (anyErr.code === "ER_DUP_ENTRY" || anyErr.errno === 1062) {
    return true;
  }

  if (anyErr.cause && typeof anyErr.cause === "object") {
    const cause = anyErr.cause as Record<string, unknown>;
    if (cause.code === "ER_DUP_ENTRY" || cause.errno === 1062) {
      return true;
    }
  }

  return false;
}
