import {Pinecone} from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY ?? "",
})

export default async function queryStore(
    query: string,
    numResults: number
) {
    const store = await pinecone.describeIndex(process.env.PINECONE_INDEX_NAME ?? "");

    // const response = await store.
}

