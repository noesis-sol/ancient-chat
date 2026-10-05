import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@/data/not-found';

const clerk = vi.hoisted(() => ({
  getAuth: vi.fn(),
  currentUser: vi.fn()
}));

const indexes = vi.hoisted(() => ({
  deleteIndex: vi.fn(),
  updateIndex: vi.fn(),
  toggleIndex: vi.fn()
}));

const prompts = vi.hoisted(() => ({
  updatePrompt: vi.fn()
}));

vi.mock('@clerk/nextjs/server', () => clerk);

vi.mock('@/data/indexes.service', () => ({
  IndexesService: class {
    deleteIndex = indexes.deleteIndex;
    updateIndex = indexes.updateIndex;
    toggleIndex = indexes.toggleIndex;
  }
}));

vi.mock('@/data/prompt.service', () => ({
  PromptService: class {
    updatePrompt = prompts.updatePrompt;
  }
}));

const { MAX_PROMPT_CHARS } = await import('@/utils/admin-api');
const { DELETE, PUT: putIndex } = await import('@/app/api/indexes/[name]/route');
const { PATCH } = await import('@/app/api/indexes/[name]/toggle/route');
const { PUT: putPrompt } = await import('@/app/api/prompt/[id]/route');

const nameParams = () => ({ params: Promise.resolve({ name: 'plato' }) });
const idParams = () => ({ params: Promise.resolve({ id: 'prompt-1' }) });

const request = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/x', {
    method,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });

const updateIndex = (body: unknown) => putIndex(request('PUT', body), nameParams());
const toggleIndex = (body: unknown) => PATCH(request('PATCH', body), nameParams());
const updatePrompt = (body: unknown) => putPrompt(request('PUT', body), idParams());

const expectJsonError = async (response: Response, status: number) => {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const { error } = await response.json();
  expect(typeof error).toBe('string');
  return error as string;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  clerk.getAuth.mockReturnValue({ userId: 'user_1', sessionClaims: { metadata: { role: 'admin' } } });
  clerk.currentUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });
  prompts.updatePrompt.mockImplementation(async (id: string, { text }: { text: string }) => ({
    id,
    text,
    is_active: true
  }));
});

describe('PUT /api/indexes/[name]', () => {
  it('updates the weight', async () => {
    const response = await updateIndex({ weight: 0.25 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(indexes.updateIndex).toHaveBeenCalledWith('plato', { weight: 0.25 });
  });

  it('accepts the bounds 0 and 1', async () => {
    expect((await updateIndex({ weight: 0 })).status).toBe(200);
    expect((await updateIndex({ weight: 1 })).status).toBe(200);
  });

  it('drops fields other than the weight, such as id and name', async () => {
    const response = await updateIndex({ weight: 0.5, id: 'other-host', name: 'aristotle', is_active: true });

    expect(response.status).toBe(200);
    expect(indexes.updateIndex).toHaveBeenCalledWith('plato', { weight: 0.5 });
  });

  it.each([
    ['a negative weight', { weight: -0.1 }],
    ['a weight above 1', { weight: 1e9 }],
    ['a string weight', { weight: '0.5' }],
    ['a null weight', { weight: null }],
    ['no weight', { name: 'aristotle' }],
    ['an array body', [0.5]],
    ['a null body', null]
  ])('returns 400 for %s', async (_, body) => {
    await expectJsonError(await updateIndex(body), 400);
    expect(indexes.updateIndex).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    expect(await expectJsonError(await updateIndex('{weight'), 400)).toBe('Request body is not valid JSON');
    expect(indexes.updateIndex).not.toHaveBeenCalled();
  });

  it('returns 404 JSON for an unknown index', async () => {
    indexes.updateIndex.mockRejectedValue(new NotFoundError('Index "plato" not found'));

    expect(await expectJsonError(await updateIndex({ weight: 0.5 }), 404)).toBe('Index "plato" not found');
  });

  it('returns 500 JSON without details for other failures', async () => {
    indexes.updateIndex.mockRejectedValue(new Error('connection refused at db:5432'));

    expect(await expectJsonError(await updateIndex({ weight: 0.5 }), 500)).toBe('Internal server error');
  });
});

describe('PATCH /api/indexes/[name]/toggle', () => {
  it.each([true, false])('sets isActive to %s', async (isActive) => {
    const response = await toggleIndex({ isActive });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(indexes.toggleIndex).toHaveBeenCalledWith('plato', isActive);
  });

  it.each([
    ['a string', { isActive: 'true' }],
    ['a number', { isActive: 1 }],
    ['null', { isActive: null }],
    ['a missing field', {}]
  ])('returns 400 when isActive is %s', async (_, body) => {
    expect(await expectJsonError(await toggleIndex(body), 400)).toMatch(/isActive/);
    expect(indexes.toggleIndex).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    await expectJsonError(await toggleIndex('nope'), 400);
    expect(indexes.toggleIndex).not.toHaveBeenCalled();
  });

  it('returns 404 JSON for an unknown index', async () => {
    indexes.toggleIndex.mockRejectedValue(new NotFoundError('Index "plato" not found'));

    expect(await expectJsonError(await toggleIndex({ isActive: true }), 404)).toBe('Index "plato" not found');
  });
});

describe('DELETE /api/indexes/[name]', () => {
  const deleteIndex = () => DELETE(request('DELETE'), nameParams());

  it('deletes the index', async () => {
    const response = await deleteIndex();

    expect(response.status).toBe(200);
    expect(indexes.deleteIndex).toHaveBeenCalledWith('plato');
  });

  it('returns 404 JSON for an unknown index', async () => {
    indexes.deleteIndex.mockRejectedValue(new NotFoundError('Index "plato" not found'));

    expect(await expectJsonError(await deleteIndex(), 404)).toBe('Index "plato" not found');
  });

  it('returns 500 JSON when Pinecone fails', async () => {
    indexes.deleteIndex.mockRejectedValue(new Error('Pinecone unavailable'));

    expect(await expectJsonError(await deleteIndex(), 500)).toBe('Internal server error');
  });
});

describe('PUT /api/prompt/[id]', () => {
  it('updates the text', async () => {
    const response = await updatePrompt({ text: 'You are Socrates.' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'prompt-1', text: 'You are Socrates.', is_active: true });
    expect(prompts.updatePrompt).toHaveBeenCalledWith('prompt-1', { text: 'You are Socrates.' });
  });

  it('accepts text at the maximum length', async () => {
    const text = 'a'.repeat(MAX_PROMPT_CHARS);

    expect((await updatePrompt({ text })).status).toBe(200);
    expect(prompts.updatePrompt).toHaveBeenCalledWith('prompt-1', { text });
  });

  it('drops fields other than the text, such as is_active', async () => {
    await updatePrompt({ text: 'You are Socrates.', is_active: false, id: 'prompt-2' });

    expect(prompts.updatePrompt).toHaveBeenCalledWith('prompt-1', { text: 'You are Socrates.' });
  });

  it.each([
    ['missing text', {}],
    ['empty text', { text: '' }],
    ['blank text', { text: ' \n\t ' }],
    ['non-string text', { text: 42 }],
    ['text over the maximum length', { text: 'a'.repeat(MAX_PROMPT_CHARS + 1) }]
  ])('returns 400 for %s', async (_, body) => {
    expect(await expectJsonError(await updatePrompt(body), 400)).toMatch(/text/);
    expect(prompts.updatePrompt).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    await expectJsonError(await updatePrompt('text=hi'), 400);
    expect(prompts.updatePrompt).not.toHaveBeenCalled();
  });

  it('returns 404 JSON for an unknown id', async () => {
    prompts.updatePrompt.mockRejectedValue(new NotFoundError('Prompt "prompt-1" not found'));

    expect(await expectJsonError(await updatePrompt({ text: 'You are Socrates.' }), 404)).toBe(
      'Prompt "prompt-1" not found'
    );
  });
});
