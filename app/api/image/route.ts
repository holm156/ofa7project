import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import path from 'path';
import { readFile } from 'fs/promises';
import mime from 'mime-types';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');
    const chapterId = searchParams.get('chapterId');

    if (!imageUrl || !chapterId) {
        return new NextResponse('Missing parameters', { status: 400 });
    }

    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id;
    // @ts-ignore
    const isAdmin = session?.user?.role === 'admin';

    try {
        // 1. Fetch chapter to check price and permissions
        const chapter = await prisma.chapter.findUnique({
            where: { id: chapterId },
            select: { id: true, price: true, freeDate: true, pages: true }
        });

        if (!chapter) {
            return new NextResponse('Chapter not found', { status: 404 });
        }

        // 2. Permission Check
        const isFree = chapter.freeDate && new Date() > new Date(chapter.freeDate);
        let canRead = chapter.price === 0 || isFree || isAdmin;

        if (!canRead && userId) {
            const unlocked = await prisma.unlockedChapter.findFirst({
                where: { userId, chapterId }
            });
            if (unlocked) canRead = true;
        }

        if (!canRead) {
            return new NextResponse('Unauthorized access to this chapter', { status: 403 });
        }

        // 3. Security: Verify the URL is actually part of this chapter's pages
        // This prevents users from using a purchased chapter ID to view other chapters' images.
        let pages: string[] = [];
        try {
            pages = typeof chapter.pages === 'string' ? JSON.parse(chapter.pages) : (Array.isArray(chapter.pages) ? chapter.pages : []);
        } catch (e) {
            console.error("Pages parse error", e);
        }

        if (!pages.includes(imageUrl)) {
            return new NextResponse('Invalid image for this chapter', { status: 403 });
        }

        // 4. Handle Wasabi (Fast Redirect with Presigned URL)
        const { resolveWasabiKeyFromUrl, isWasabiConfigured, getPresignedUrl } = await import('@/lib/wasabi');
        const wasabiKey = resolveWasabiKeyFromUrl(imageUrl);

        if (wasabiKey && isWasabiConfigured()) {
            try {
                // Generate a temporary signed URL that allows public access even for private objects
                const signedUrl = await getPresignedUrl(wasabiKey, 3600); // 1 hour expiry
                
                // Redirect the browser to download directly from Wasabi
                return NextResponse.redirect(signedUrl);
            } catch (err) {
                console.error("Wasabi Redirect Error:", err);
                return new NextResponse('Failed to generate secure link', { status: 500 });
            }
        }

        // 5. Local File Fallback
        const filePath = path.join(process.cwd(), 'public', imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl);

        try {
            const data = await readFile(filePath);
            const contentType = mime.lookup(filePath) || 'application/octet-stream';

            return new NextResponse(data, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000, immutable'
                }
            });
        } catch (err) {
            console.error("File read error", err);
            return new NextResponse('Image file not found on server', { status: 404 });
        }

    } catch (e) {
        console.error("Proxy error:", e);
        return new NextResponse('Internal error', { status: 500 });
    }
}
