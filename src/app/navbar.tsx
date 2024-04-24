import Link from "next/link";

export default function Navbar() {
    return (
        <div className="navbar bg-black text-white">
            <Link href='/' className="btn btn-ghost text-xl">AGR</Link>
        </div>
    );
}
