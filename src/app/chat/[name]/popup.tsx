export default function Popup({id, title, text}: { id: string, title: string, text: [string] }) {
    return (
        <>
            {/* @ts-ignore */}
            <label for={id} className="btn btn-link min-h-0 h-auto">
                {title}
            </label>
            <input type="checkbox" id={id} className="modal-toggle"/>
            {/* @ts-ignore */}
            <label for={id} className="modal text-black">
                <div className="modal-box relative max-w-none max-w-4xl">
                    <h3 className="font-bold text-lg">Source</h3>
                    <p className="p-4">
                        <ol className="list-decimal">
                            {text.map(s => (
                                <li key={Date.now().toString()}>{s}</li>))}
                        </ol>
                    </p>
                </div>
            </label>
        </>
    )
}
