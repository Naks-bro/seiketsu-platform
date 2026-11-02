import "server-only";
import { after } from "next/server";

/**
 * Runs work after the response is sent (Next.js `after`). Outside a request
 * (scripts, tests) it simply runs in the background. Errors are logged, never thrown.
 */
export function runAfter(task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => console.error("[after] task failed", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}