import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  getAuth: vi.fn(),
  currentUser: vi.fn()
}));

const prompts = vi.hoisted(() => ({
  getPrompt: vi.fn(),
  updatePrompt: vi.fn()
}));

vi.mock('@clerk/nextjs/server', () => clerk);

vi.mock('@/data/prompt.service', () => ({
  PromptService: class {
    getPrompt = prompts.getPrompt;
    updatePrompt = prompts.updatePrompt;
  }
}));

const { checkAdmin } = await import('@/utils/adminAuth');
const { GET } = await import('@/app/api/prompt/route');
const { PUT } = await import('@/app/api/prompt/[id]/route');

const storedPrompt = { id: 'prompt-1', text: 'You are Aristotle.', is_active: true };

const signedOut = () => {
  clerk.getAuth.mockReturnValue({ userId: null });
  clerk.currentUser.mockResolvedValue(null);
};

const signedInAs = (role: string) => {
  clerk.getAuth.mockReturnValue({ userId: 'user_1', sessionClaims: { metadata: { role } } });
};

const getRequest = () => new NextRequest('http://localhost/api/prompt?ancient=aristotle');

const putRequest = () =>
  new NextRequest('http://localhost/api/prompt/prompt-1', {
    method: 'PUT',
    body: JSON.stringify({ text: 'You are Socrates.' })
  });

const putParams = { params: Promise.resolve({ id: 'prompt-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  prompts.getPrompt.mockResolvedValue(storedPrompt);
  prompts.updatePrompt.mockImplementation(async (id: string, { text }: { text: string }) => ({
    ...storedPrompt,
    id,
    text
  }));
});

describe('checkAdmin', () => {
  it('rejects a signed-out request with 401', async () => {
    signedOut();

    await expect(checkAdmin(getRequest())).resolves.toEqual({ ok: false, status: 401, error: 'Unauthorized' });
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it('rejects a signed-in non-admin with 403', async () => {
    signedInAs('member');

    await expect(checkAdmin(getRequest())).resolves.toEqual({ ok: false, status: 403, error: 'Forbidden' });
  });

  it('rejects a signed-in user whose profile cannot be loaded with 403', async () => {
    clerk.getAuth.mockReturnValue({ userId: 'user_1' });
    clerk.currentUser.mockResolvedValue(null);

    await expect(checkAdmin(getRequest())).resolves.toEqual({ ok: false, status: 403, error: 'Forbidden' });
  });

  it('accepts an admin', async () => {
    signedInAs('admin');

    await expect(checkAdmin(getRequest())).resolves.toEqual({ ok: true });
  });
});

describe('GET /api/prompt', () => {
  it('returns 401 when signed out', async () => {
    signedOut();

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(prompts.getPrompt).not.toHaveBeenCalled();
  });

  it('returns 403 for a signed-in non-admin', async () => {
    signedInAs('member');

    const response = await GET(getRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(prompts.getPrompt).not.toHaveBeenCalled();
  });

  it('returns the prompt for an admin', async () => {
    signedInAs('admin');

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(storedPrompt);
  });
});

describe('PUT /api/prompt/[id]', () => {
  it('returns 401 when signed out', async () => {
    signedOut();

    const response = await PUT(putRequest(), putParams);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(prompts.updatePrompt).not.toHaveBeenCalled();
  });

  it('returns 403 for a signed-in non-admin', async () => {
    signedInAs('member');

    const response = await PUT(putRequest(), putParams);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(prompts.updatePrompt).not.toHaveBeenCalled();
  });

  it('updates the prompt for an admin', async () => {
    signedInAs('admin');

    const response = await PUT(putRequest(), putParams);

    expect(response.status).toBe(200);
    expect(prompts.updatePrompt).toHaveBeenCalledWith('prompt-1', { text: 'You are Socrates.' });
    expect(await response.json()).toEqual({ ...storedPrompt, text: 'You are Socrates.' });
  });
});
