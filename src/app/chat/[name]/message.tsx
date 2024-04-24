export interface MessageProps {
    id?: string,
    message: string;
    user?: string;
    direction: 'incoming' | 'outgoing';
}


export default function Message({message, user, direction}: MessageProps) {
    let chatDirection = 'chat-start';
    if (direction === 'outgoing') {
        chatDirection = 'chat-end';
    }
    return (
        <div className="col-start-1 col-end-13">
            <div className={`chat ${chatDirection}`}>
                <div className="chat-bubble">{message}</div>
            </div>
        </div>
    );
}
