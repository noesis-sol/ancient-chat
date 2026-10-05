import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getIndex, getPinecone } from '@/lib/pinecone';
import { withAdmin } from '@/utils/adminAuth';
import { replaceFileChunks } from '@/utils/upload-chunks';
import { checkUploadPath, FILE_TOO_LARGE_MESSAGE, MAX_UPLOAD_FILE_SIZE } from '@/utils/upload-rules';

// Creating an index and waiting until it is ready takes up to 30 s, and
// embedding a large file takes a while too. 60 s is the most Vercel allows on
// the Hobby plan without fluid compute (the default is 10 s).
export const maxDuration = 60;

// Custom error class for better error handling
class IndexError extends Error {
    constructor(
        message: string,
        public status: number,
        public code: string
    ) {
        super(message);
        this.name = 'IndexError';
    }
}

export const POST = withAdmin(async (request: NextRequest) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const path = formData.get('path') as string;
        const filename = formData.get('filename') as string;
        const fileType = formData.get('type') as string;

        if (!file) {
            throw new IndexError(
                'No file was provided for upload',
                400,
                'NO_FILE'
            );
        }

        if (!path) {
            throw new IndexError(
                'File path is required',
                400,
                'NO_PATH'
            );
        }

        // The folder's name becomes the index name; only .txt and .md files inside it are indexed
        const pathCheck = checkUploadPath(path);
        if ('code' in pathCheck) {
            throw new IndexError(pathCheck.message, 400, pathCheck.code);
        }
        const { indexName } = pathCheck;

        // Vercel rejects larger request bodies before they reach the route
        if (file.size > MAX_UPLOAD_FILE_SIZE) {
            throw new IndexError(
                FILE_TOO_LARGE_MESSAGE,
                400,
                'FILE_TOO_LARGE'
            );
        }

        // Read file content
        const content = await file.text();
        if (!content.trim()) {
            throw new IndexError(
                'File is empty',
                400,
                'EMPTY_FILE'
            );
        }

        const pinecone = getPinecone();

        // Get list of existing indexes
        let indexList;
        try {
            indexList = await pinecone.listIndexes();
        } catch {
            throw new IndexError(
                'Failed to connect to Pinecone',
                503,
                'PINECONE_CONNECTION_ERROR'
            );
        }
        
        // Check if index exists, if not create it
        if (!indexList.indexes?.find(index => index.name === indexName)) {
            try {
                // A concurrent upload into the same new folder may create it first
                await pinecone.createIndex({
                    suppressConflicts: true,
                    name: indexName,
                    dimension: 1536,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: env().PINECONE_CLOUD,
                            region: env().PINECONE_REGION
                        }
                    }
                });

                // Wait for index to be ready with timeout
                let isReady = false;
                let attempts = 0;
                const maxAttempts = 30; // 30 seconds timeout

                while (!isReady && attempts < maxAttempts) {
                    const description = await pinecone.describeIndex(indexName);
                    if (description.status.ready) {
                        isReady = true;
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        attempts++;
                    }
                }

                if (!isReady) {
                    throw new IndexError(
                        'Timeout while waiting for index creation',
                        500,
                        'INDEX_CREATION_TIMEOUT'
                    );
                }
            } catch (error) {
                if (error instanceof IndexError) throw error;
                throw new IndexError(
                    'Failed to create Pinecone index',
                    500,
                    'INDEX_CREATION_ERROR'
                );
            }
        }

        // Get the index
        const index = await getIndex(indexName);

        // Initialize OpenAI embeddings
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: env().OPENAI_API_KEY,
        });

        // Initialize text splitter
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        // Create LangChain document
        const doc = new Document({
            pageContent: content,
            metadata: {
                source: path,
                filename: filename,
                type: fileType,
            },
        });

        // Split text into chunks
        const docs = await textSplitter.splitDocuments([doc]);

        // Embed and upsert the chunks in batches, then delete the ones a longer earlier upload left
        try {
            await replaceFileChunks(index, path, docs, (texts) => embeddings.embedDocuments(texts));
        } catch (error) {
            console.error('Error upserting chunks:', error);
            throw new IndexError(
                'Failed to process and upload document batch',
                500,
                'BATCH_PROCESSING_ERROR'
            );
        }

        return NextResponse.json({ 
            success: true,
            indexName: indexName,
            message: 'File successfully processed and indexed'
        });
    } catch (error) {
        console.error('Error processing file:', error);

        if (error instanceof IndexError) {
            return NextResponse.json(
                { 
                    error: error.message,
                    code: error.code
                },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { 
                error: 'An unexpected error occurred while processing the file',
                code: 'UNKNOWN_ERROR'
            },
            { status: 500 }
        );
    }
});
