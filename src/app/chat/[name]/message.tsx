export interface MessageProps {
    id?: string,
    message: string;
    user?: string;
    direction: 'incoming' | 'outgoing';
}


export default function Message({message, user, direction}: MessageProps) {
    if (direction === 'incoming') {
        return (
            <div className="col-start-1 col-end-8 p-3 rounded-lg">
                <div className="flex flex-row items-center">
                    <div
                        className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500 flex-shrink-0"
                    >
                        A
                    </div>
                    <div
                        className="relative ml-3 text-sm bg-white py-2 px-4 shadow rounded-xl"
                    >
                        <div>{message}</div>
                    </div>
                </div>
            </div>
        );
    } else {
        return (<div className="col-start-6 col-end-13 p-3 rounded-lg">
            <div className="flex items-center justify-start flex-row-reverse">
                <div
                    className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500 flex-shrink-0"
                >
                    A
                </div>
                <div
                    className="relative mr-3 text-sm bg-indigo-100 py-2 px-4 shadow rounded-xl"
                >
                    <div>{message}</div>
                </div>
            </div>
        </div>);
    }
}
