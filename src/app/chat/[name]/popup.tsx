import Link from "next/link";

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
                        <ol className="list-disc">
                            {text.map(s => (
                                <li key={Date.now().toString()}>{`"${s}" - `} <Link
                                    className={"text-blue-500"}
                                    target="_blank"
                                    href="https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0054%3Abekker%20page%3D1167b%3Abekker%20line%3D20">Nicomachean
                                    Ethics</Link>
                                </li>))}
                        </ol>
                    </p>
                </div>
            </label>
        </>
    )
}
