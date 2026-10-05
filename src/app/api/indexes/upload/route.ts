import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { cleanMetadata, getRootFolderName, sanitizeIndexName } from '@/utils/index-upload';

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

export async function POST(request: NextRequest) {
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

        // Get and sanitize the index name from the root folder
        const rootFolder = getRootFolderName(path);
        const indexName = sanitizeIndexName(rootFolder);

        if (!indexName) {
            throw new IndexError(
                'Invalid folder name. Please use alphanumeric characters, hyphens, or underscores',
                400,
                'INVALID_INDEX_NAME'
            );
        }

        // Validate file size (e.g., 10MB limit)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) {
            throw new IndexError(
                'File size exceeds the maximum limit of 10MB',
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

        // Initialize Pinecone client
        if (!process.env.PINECONE_API_KEY) {
            throw new IndexError(
                'Pinecone API key is not configured',
                500,
                'MISSING_API_KEY'
            );
        }

        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        
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
                await pinecone.createIndex({
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
        const index = pinecone.Index(indexName);

        // Initialize OpenAI embeddings
        if (!process.env.OPENAI_API_KEY) {
            throw new IndexError(
                'OpenAI API key is not configured',
                500,
                'MISSING_OPENAI_KEY'
            );
        }

        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
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

        // Process documents in batches
        const batchSize = 100;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = docs.slice(i, i + batchSize);
            try {
                const vectors = await Promise.all(
                    batch.map(async (doc, j) => {
                        const embedding = await embeddings.embedDocuments([doc.pageContent]);
                        const cleanedMetadata = cleanMetadata({
                            ...doc.metadata,
                            text: doc.pageContent,
                        });
                        
                        return {
                            id: `${path}-${i + j}`,
                            values: embedding[0],
                            metadata: cleanedMetadata,
                        };
                    })
                );
                await index.upsert(vectors);
            } catch {
                throw new IndexError(
                    'Failed to process and upload document batch',
                    500,
                    'BATCH_PROCESSING_ERROR'
                );
            }
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
}