import { beforeEach, describe, expect, it, vi } from 'vitest';

const protect = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: { protect } }));

const { default: ChatLayout } = await import('@/app/(main)/chat/layout');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the /chat layout', () => {
  it('sends a signed-out visitor to sign in', async () => {
    protect.mockRejectedValue(new Error('NEXT_REDIRECT /sign-in'));

    await expect(ChatLayout({ children: 'chat' })).rejects.toThrow('NEXT_REDIRECT /sign-in');
  });

  it('renders the chat for a signed-in user', async () => {
    protect.mockResolvedValue({ userId: 'user_1' });

    await expect(ChatLayout({ children: 'chat' })).resolves.toBe('chat');
    expect(protect).toHaveBeenCalledOnce();
  });
});
