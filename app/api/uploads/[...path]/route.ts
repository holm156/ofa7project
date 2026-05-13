import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: filePathArray } = await params;
        const filePath = path.join(process.cwd(), 'public', 'uploads', ...filePathArray);
        const resolvedPath = path.resolve(filePath);

        console.log(`[SERVE] Requested: ${filePathArray.join('/')}`);
        console.log(`[SERVE] Resolved Path: ${resolvedPath}`);

        // Security check: Ensure the path is inside public/uploads
        const absolutePublicUploads = path.resolve(path.join(process.cwd(), 'public', 'uploads'));
        
        if (!resolvedPath.startsWith(absolutePublicUploads)) {
            console.warn(`[SERVE] Forbidden access attempt: ${resolvedPath}`);
            return new NextResponse('Forbidden', { status: 403 });
        }

        if (!fs.existsSync(resolvedPath)) {
            console.warn(`[SERVE] File not found: ${resolvedPath}`);
            return new NextResponse('Not Found', { status: 404 });
        }

        const fileBuffer = fs.readFileSync(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        
        const contentTypeMap: Record<string, string> = {
            '.webp': 'image/webp',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
        };

        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Error serving file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
