import { NotFoundError } from '@/data/not-found';
import { MAX_WEIGHT, MIN_WEIGHT } from '@/utils/index-actions';
import { MAX_PROMPT_CHARS } from '@/utils/prompt-text';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export { MAX_PROMPT_CHARS };

// Each schema names the only fields its route writes; unknown keys are dropped,
// so a caller cannot change an index's id or name, or anything else on the row.
export const indexUpdateSchema = z.object({
  weight: z.number().min(MIN_WEIGHT).max(MAX_WEIGHT)
});

export const indexToggleSchema = z.object({
  isActive: z.boolean()
});

export const promptUpdateSchema = z.object({
  text: z
    .string()
    .max(MAX_PROMPT_CHARS)
    .refine((text) => text.trim() !== '', { message: 'Must not be empty' })
});

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

// Reads a JSON body and validates it. Anything that isn't JSON or doesn't match
// the schema gets a 400 naming the offending fields.
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<BodyResult<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 }) };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .join('; ');
    return { ok: false, response: NextResponse.json({ error }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}

// Wraps a route handler so failures still answer JSON: a NotFoundError becomes a
// 404 with its message, anything else a 500 (logged, details kept server-side).
export const withJsonErrors =
  <Args extends unknown[]>(handler: (request: NextRequest, ...args: Args) => Promise<Response>) =>
  async (request: NextRequest, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error(error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
