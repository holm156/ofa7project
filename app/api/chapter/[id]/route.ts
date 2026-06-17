import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const { id } = await Promise.resolve(params);
    try {
        const chapter = await prisma.chapter.findUnique({
            where: { id },
            include: { manga: true }
        });
        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }
        return NextResponse.json(chapter);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch chapter' }, { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // Only admins can modify/delete chapters
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    try {
        const body = await req.json();

        const chapter = await prisma.chapter.update({
            where: { id },
            data: {
                title: body.title,
                number: body.number,
                pages: typeof body.pages === 'string' ? body.pages : JSON.stringify(body.pages || []),
                price: body.price,
                freeDate: body.freeDate ? new Date(body.freeDate) : null,
                sourceName: body.sourceName,
                sourceColor: body.sourceColor,
                releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined,
                mangaId: body.mangaId
            } as any
        });

        return NextResponse.json(chapter);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    try {
        const chapter = await prisma.chapter.findUnique({
            where: { id },
            select: { mangaId: true }
        });

        if (chapter) {
            await prisma.chapter.delete({ where: { id } });
            await prisma.manga.update({
                where: { id: chapter.mangaId },
                data: { chapterCount: { decrement: 1 } }
            });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
