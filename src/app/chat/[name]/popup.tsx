export default function Popup({id, title, text}: { id: string, title: string, text: [string] }) {
    return (
        <>
            <button className="btn btn-link min-h-0 h-auto"
                    onClick={() => document.getElementById(id)?.showModal()}>{title}
            </button>
            <dialog id={id} className="modal text-black">
                <div className="modal-box">
                    <h3 className="font-bold text-lg">Source</h3>
                    <p className="p-4">
                        <ol className="list-decimal">
                            {text.map(s => (
                                <li key={Date.now().toString()}>{s}</li>))}
                        </ol>
                    </p>
                    <div className="modal-action">
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>
        </>
    )
}
