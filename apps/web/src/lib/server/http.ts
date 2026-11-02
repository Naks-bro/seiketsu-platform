import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { OrderError } from "./orders";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Turns known errors into clean JSON responses; logs the rest. */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return jsonError("Please check the highlighted fields.", 400, { fieldErrors });
  }
  if (err instanceof OrderError) return jsonError(err.message, err.status);
  console.error("[api] unexpected error", err);
  return jsonError("Something went wrong on our side. Please try again.", 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new OrderError("Invalid request.", 400);
  }
}