import {redirect} from "next/navigation";
import {currentUser} from "@clerk/nextjs/server";
import {IndexList, Pinecone} from "@pinecone-database/pinecone";
import AccordionSection from "@/components/accordion";
import IndexUploadModal from "@/components/file-upload-modal";

const pinecone = new Pinecone();

const approvedEmails = [
    'adam@agr-series.com',
    'michael@agr-series.com',
    'michael@noesis.solutions',
    'andreas@noesis.solutions',
]

export default async function AdminPage() {
    const user = await currentUser()
    const [email] = user?.emailAddresses ?? []

    if (!user || !approvedEmails.includes(email?.emailAddress ?? '')) {
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
            <IndexUploadModal/>
            <AccordionSection accordionData={myAccordionData}/>
        </div>
    );
};