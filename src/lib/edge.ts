/* Reading the real reason out of a failed edge-function call.

   invoke() reports any non-2xx as a generic FunctionsHttpError ("…non-2xx
   status code") and hands back the Response as .context. The reason the
   function actually gave is in that body, so read it — a failed address should
   report "unknown instrument: foo", not the wrapper. */

/** The JSON body of a call, whether it succeeded or not — for a function that
    answers with a machine-readable reason a caller wants to branch on. */
export async function failureBody(error: any, data: any): Promise<any> {
  if (!error) return data;
  const res: Response | undefined =
    typeof Response !== "undefined" && error?.context instanceof Response ? error.context : undefined;
  if (!res) return undefined;
  try {
    return await res.clone().json();
  } catch {
    return undefined; // not JSON — the caller falls back to failureMessage()
  }
}

export async function failureMessage(error: any, data: any): Promise<string | undefined> {
  if (!error) {
    const inline = (data as any)?.error;
    return inline ? String(inline) : undefined;
  }
  const res: Response | undefined =
    typeof Response !== "undefined" && error?.context instanceof Response ? error.context : undefined;
  if (res) {
    try {
      const body = await res.clone().json();
      if (body?.error) return String(body.error);
    } catch { /* not JSON — fall through */ }
    try {
      const text = (await res.clone().text()).trim();
      if (text) return text.slice(0, 300);
    } catch { /* unreadable — fall through */ }
  }
  return String(error?.message ?? error);
}
