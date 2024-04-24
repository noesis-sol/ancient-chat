import Link from "next/link";

export default function Home() {
    return (
        <section
            className="bg-white dark:bg-[#0b1727] text-indigo-900 dark:text-white relative z-10 overflow-hidden">
            <div className="hero min-h-[calc(100vh-64px)] bg-base-200">
                <div className="hero-content flex-col lg:flex-row-reverse">
                    <img
                        src="https://yt3.googleusercontent.com/4eUXHkAB-XSqTDzKwvWHmQgZ2njUkqbqoXRIi9kHayq_ssr_8zqw5HMfDMQjSw-Fx8wXPLWAfbM=s176-c-k-c0x00ffffff-no-rj"
                        className="max-w-sm rounded-lg shadow-2xl"/>
                    <div>
                        <h1 className="text-5xl font-bold">Chat with the ancients!</h1>
                        <p className="py-6">A place to talk with the ancients.</p>
                        <Link href='/chat' className="btn btn-primary">Get Started</Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
