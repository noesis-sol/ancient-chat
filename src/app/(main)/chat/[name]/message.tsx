import Popup from '@/app/(main)/chat/[name]/popup';

export interface MessageProps {
  id?: string;
  message: string;
  user?: string;
  source?: [string] | string;
  direction: 'incoming' | 'outgoing';
  isLoading?: boolean;
}

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Message({ message, id, user, source, direction, isLoading }: MessageProps) {
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
          {source && source.length ? <Popup id={id ?? uuidv4()} text={source} title='view source' /> : null}
        </div>
      </div>
    </div>
  );
}
