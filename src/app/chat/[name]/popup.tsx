import Link from 'next/link';

export default function Popup({ id, title, text }: { id: string; title: string; text: [string] }) {
  return (
    <>
      {/* @ts-ignore */}
      <label for={id} className="btn btn-link min-h-0 h-auto">
        {title}
      </label>
      <input type="checkbox" id={id} className="modal-toggle" />
      {/* @ts-ignore */}
      <label for={id} className="modal">
        <div className="modal-box max-w-3xl text-base-content">
          <h3 className="font-bold text-lg">Source</h3>
          <p className="p-4">
            <ol className="list">
              {text.map((s) => (
                <li className="py-5 flex flex-col" key={Date.now().toString()}>
                  <p className="grow">{s}</p>
                  <p className="flex justify-end">
                    <Link
                      className="text-blue-500 pus"
                      target="_blank"
                      href="https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0054%3Abekker%20page%3D1167b%3Abekker%20line%3D20"
                    >
                      -- Nicomachean Ethics
                    </Link>
                  </p>
                </li>
              ))}
            </ol>
          </p>
        </div>
      </label>
    </>
  );
}
