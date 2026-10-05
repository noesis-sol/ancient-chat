import Popup from '@/app/(main)/chat/[name]/popup';
import type { ContextSource } from '@/utils/context-sources';

export interface MessageProps {
  message: string;
  user?: string;
  sources?: ContextSource[];
  direction: 'incoming' | 'outgoing';
  isLoading?: boolean;
}

export default function Message({ message, sources, direction, isLoading }: MessageProps) {
  let chatDirection = 'chat-start';
  let chatBg = 'bg-white dark:bg-gray-500 dark:text-gray-300 text-gray-600';
  if (direction === 'outgoing') {
    chatDirection = 'chat-end';
    chatBg = '';
  }

  return (
    <div className='col-start-1 col-end-13'>
      <div className={`chat ${chatDirection}`}>
        <div className={`chat-bubble ${chatBg} ${isLoading ? 'pb-0' : ''}`}>
          {isLoading ? <span className='loading loading-dots loading-md'></span> : message}{' '}
          {sources && sources.length ? <Popup sources={sources} title='view source' /> : null}
        </div>
      </div>
    </div>
  );
}
