// app/api/upload/route.ts
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { NextRequest, NextResponse } from 'next/server';

// Function to sanitize index name according to Pinecone's requirements
function sanitizeIndexName(name: string): string {
    // Remove leading slash if present
    name = name.startsWith('/') ? name.slice(1) : name;
    // Convert to lowercase and replace invalid characters with hyphens
    return name.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with a single one
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Function to get the root folder name from a path
function getRootFolderName(path: string): string {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    // Get the first segment of the path
    return cleanPath.split('/')[0];
}

// Function to clean metadata for Pinecone
function cleanMetadata(metadata: Record<string, any>): Record<string, string | number | boolean | string[]> {
    const cleanedMetadata: Record<string, string | number | boolean | string[]> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            (Array.isArray(value) && value.every(item => typeof item === 'string'))
        ) {
            cleanedMetadata[key] = value;
        } else if (value !== null && value !== undefined) {
            // Convert complex objects to strings
            cleanedMetadata[key] = JSON.stringify(value);
        }
    }
    
    return cleanedMetadata;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const path = formData.get('path') as string;
        const filename = formData.get('filename') as string;
        const fileType = formData.get('type') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Get and sanitize the index name from the root folder
        const rootFolder = getRootFolderName(path);
        const indexName = sanitizeIndexName(rootFolder);

        if (!indexName) {
            return NextResponse.json(
                { error: 'Invalid index name derived from folder path' },
                { status: 400 }
            );
        }

        // Read file content
        const content = await file.text();

        // Initialize Pinecone client
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });
        
        // Get list of existing indexes
        const indexList = await pinecone.listIndexes();
        
        // Check if index exists, if not create it
        if (!indexList.indexes?.find(index => index.name === indexName)) {
            try {
                await pinecone.createIndex({
                    name: indexName,
                    dimension: 1536,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: 'us-east-1'
                        }
                    }
                });

                // Wait for index to be ready
                let isReady = false;
                while (!isReady) {
                    const description = await pinecone.describeIndex(indexName);
                    if (description.status.ready) {
                        isReady = true;
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                console.error('Error creating index:', error);
                return NextResponse.json(
                    { error: 'Failed to create index' },
                    { status: 500 }
                );
            }
        }

        // Get the index
        const index = pinecone.Index(indexName);

        // Initialize OpenAI embeddings
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
            const vectors = await Promise.all(
                batch.map(async (doc, j) => {
                    const embedding = await embeddings.embedDocuments([doc.pageContent]);
                    // Clean metadata before uploading
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
        }

        return NextResponse.json({ 
            success: true,
            indexName: indexName 
        });
    } catch (error) {
        console.error('Error processing file:', error);
        return NextResponse.json(
            { error: 'Error processing file' },
            { status: 500 }
        );
    }
}