import { rateLimitMessage } from '@/utils/rate-limit-message';

// The chat bubble shown when a reply failed, with a button to ask again.
export default function ChatError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className='col-start-1 col-end-13'>
      <div className='chat chat-start'>
        <div role='alert' className='chat-bubble chat-bubble-error'>
          {rateLimitMessage(error) ?? 'Something went wrong while getting a reply.'}{' '}
          <button type='button' className='btn btn-sm ml-2' onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
