/** Shared shape returned by every Server Action that backs a form. */
export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idleState: ActionState = { status: "idle" };

export function errorState(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) };
}

export function successState(message: string): ActionState {
  return { status: "success", message };
}

/** Collapses a ZodError into a `field -> message` map for form rendering. */
export function toFieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    result[key] ??= issue.message;
  }
  return result;
}

/** Turns a FormData object into a plain record for Zod parsing. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      const existing = result[key];
      if (existing === undefined) {
        result[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
