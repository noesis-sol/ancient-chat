import {ArrowRightIcon} from "@heroicons/react/16/solid";
import Link from "next/link";

export default function Home() {
    return (
        <section
            className="py-24 md:py-44 bg-white dark:bg-[#0b1727] text-indigo-900 dark:text-white relative z-10 overflow-hidden">
            {/*<HeroHeaderShape/>*/}

            <div className="container px-4 mx-auto relative">
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-6 xl:col-span-5 xl:pr-12 text-center lg:text-start">
                        <div className="flex flex-col justify-center h-full">
                            <h2 className="text-3xl font-bold md:text-[70px] leading-none mb-6">
                                Chat with the ancients
                            </h2>
                            <p className="text-[22px] leading-normal opacity-80">
                                A place to talk with the ancients
                            </p>
                            <div>
                                <Link
                                    href="/chat"
                                    className="bg-white dark:bg-slate-900 text-indigo-900 dark:text-white rounded py-3 px-8 text-xl mt-6 md:mt-12 inline-block"
                                >
                                    Chat Now{" "}
                                    <ArrowRightIcon className="h-12 w-12"/>
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-12 lg:col-span-6 xl:col-span-5 text-center lg:text-start">
                        <img
                            src="https://yt3.googleusercontent.com/4eUXHkAB-XSqTDzKwvWHmQgZ2njUkqbqoXRIi9kHayq_ssr_8zqw5HMfDMQjSw-Fx8wXPLWAfbM=s176-c-k-c0x00ffffff-no-rj"
                            alt=""
                            className="rounded-full max-w-full h-32 mt-4"
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
