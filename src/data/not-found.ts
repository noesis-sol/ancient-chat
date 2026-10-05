import { Prisma } from '@prisma/client';

// Thrown by the services when the row a request names does not exist. The admin
// routes answer it with a 404 carrying the message.
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// P2025: update or delete found no record to act on.
const isRecordNotFound = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

// Runs a Prisma write, turning "record not found" into a NotFoundError.
export async function orNotFound<T>(write: () => Promise<T>, message: string): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new NotFoundError(message);
    }
    throw error;
  }
}
