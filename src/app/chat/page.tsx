import Link from "next/link";

const names = ["Xenophon", "Aristotle", "Pythagoras", "Plato", "Socrates", "Heraclitus"];

export default function Chat() {
    return (
        <section className="max-w-7xl mx-auto">
            <div className="grid grid-cols-3 gap-5 mt-5 justify-center justify-items-center">
                {names.map((name) => {
                    const lowercaseName = name.toLowerCase();
                    return (<div key={lowercaseName} className="card card-compact w-96 bg-base-100 shadow-xl">
                        <figure><img src={`/ancients/${lowercaseName}.jpeg`} alt="Shoes"/></figure>
                        <div className="card-body">
                            <h2 className="card-title">{name}</h2>
                            <p>If a dog chews shoes whose shoes does he choose?</p>
                            <div className="card-actions justify-end">
                                <Link href={`/chat/${lowercaseName}`} className="btn btn-primary">Chat</Link>
                            </div>
                        </div>
                    </div>)
                })}
            </div>
        </section>
    );
}
