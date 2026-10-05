// Function to sanitize index name according to Pinecone's requirements
export function sanitizeIndexName(name: string): string {
    // Remove leading slash if present
    name = name.startsWith('/') ? name.slice(1) : name;
    // Convert to lowercase and replace invalid characters with hyphens
    return name.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export function getRootFolderName(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return cleanPath.split('/')[0];
}

export function cleanMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean | string[]> {
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
            cleanedMetadata[key] = JSON.stringify(value);
        }
    }
    
    return cleanedMetadata;
}
