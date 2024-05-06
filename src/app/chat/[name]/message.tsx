import Popup from '@/app/chat/[name]/popup';

export interface MessageProps {
  id?: string;
  message: string;
  user?: string;
  source?: [string];
  direction: 'incoming' | 'outgoing';
}

export default function Message({ message, id, user, source, direction }: MessageProps) {
  let chatDirection = 'chat-start';
  let chatBg = 'bg-white dark:bg-gray-500 dark:text-gray-300 text-gray-600';
  if (direction === 'outgoing') {
    chatDirection = 'chat-end';
    chatBg = '';
  }

  return (
    <div className="col-start-1 col-end-13">
      <div className={`chat ${chatDirection}`}>
        <div className={`chat-bubble ${chatBg}`}>
          {message} {source ? <Popup id={id ?? Date.now().toString()} text={source} title="view source" /> : null}
        </div>
      </div>
    </div>
  );
}
