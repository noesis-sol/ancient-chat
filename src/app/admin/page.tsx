import {redirect} from "next/navigation";
import {currentUser} from "@clerk/nextjs/server";
import {IndexList, Pinecone} from "@pinecone-database/pinecone";
import AccordionSection from "@/components/accordion";

const pinecone = new Pinecone();


export default async function AdminPage() {
    const user = await currentUser()
    const [email] = user?.emailAddresses ?? []

    if (!user || ['andreas@noesis.solution'].includes(email?.emailAddress ?? '')) {
        redirect('/')
    }

    //get all indexes from pinecone
    const {indexes}: IndexList = await pinecone.listIndexes();

    const myAccordionData = indexes?.map((index) => {
        return {
            title: index.name,
            content: index.host
        };
    }) ?? [];

    return (
        <div className={'pt-5'}>
            <AccordionSection accordionData={myAccordionData}/>
        </div>
    );
};