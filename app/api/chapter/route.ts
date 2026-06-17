import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { randomUUID } from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { notifyNewChapter } from '../../../lib/discord';

// API used by Admin panel to fetch chapters for editing.
// Note: Public chapter data is fetched server-side via lib/queries.ts

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const mangaId = searchParams.get('mangaId');

        if (!mangaId) {
            return NextResponse.json({ error: 'mangaId is required' }, { status: 400 });
        }

        const chapters = await prisma.chapter.findMany({
            where: { mangaId: mangaId },
            orderBy: { number: 'desc' },
        });

        // Parse pages
        const formattedChapters = chapters.map(c => {
            let pagesArr: string[] = [];
            try {
                pagesArr = typeof c.pages === 'string' ? JSON.parse(c.pages) : (Array.isArray(c.pages) ? c.pages : []);
            } catch (err) {
                // Ignore parse errors
            }
            return {
                ...c,
                pages: pagesArr
            };
        });

        return NextResponse.json(formattedChapters);
    } catch (e) {
        console.error("Admin fetch chapters error:", e);
        return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    // Security Check
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const chapter = await prisma.chapter.create({
            data: {
                id: randomUUID(),
                updatedAt: new Date(),
                mangaId: body.mangaId,
                title: body.title,
                number: body.number,
                pages: typeof body.pages === 'string' ? body.pages : JSON.stringify(body.pages || []),
                price: body.price,
                freeDate: body.freeDate ? new Date(body.freeDate) : null,
                sourceName: body.sourceName,
                sourceColor: body.sourceColor,
                releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined
            }
        });

        await prisma.manga.update({
            where: { id: body.mangaId },
            data: { 
                updatedAt: new Date(),
                chapterCount: { increment: 1 }
            }
        });

        // Discord Notification
        try {
            const manga = await prisma.manga.findUnique({
                where: { id: body.mangaId }
            });
            if (manga) {
                await notifyNewChapter(manga, chapter, session.user?.name || 'Admin');
            }
        } catch (discordErr) {
            console.error("Discord notification error:", discordErr);
        }

        let pagesArr: string[] = [];
        try {
            pagesArr = typeof chapter.pages === 'string' ? JSON.parse(chapter.pages) : (Array.isArray(chapter.pages) ? chapter.pages : []);
        } catch (err) {
            console.error("JSON parse error for pages in POST", err);
        }

        return NextResponse.json({
            ...chapter,
            pages: pagesArr,
            isLocked: false
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}