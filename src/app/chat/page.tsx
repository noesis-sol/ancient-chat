import Link from "next/link";

const names = ["xenophon", "aristotle", "pythagoras", "plato", "socrates", "heraclitus"];

export default function Chat() {
    return (
        <section className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-0">
                {names.map((name) => (
                    <Link key={name} href={`/chat/${name}`}>
                        <img src={`/ancients/${name}.jpeg`} className="flex flex-col"/>
                    </Link>
                ))}
            </div>
        </section>
    );
}
