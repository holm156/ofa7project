import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { randomUUID } from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const { searchParams } = new URL(req.url);
    const { id: mangaId } = await Promise.resolve(params);
    const sortBy = searchParams.get('sort') || 'best'; // newest, oldest, best
    const chapterId = searchParams.get('chapterId');

    try {
        const session = await getServerSession(authOptions);
        // @ts-ignore
        const currentUserId = session?.user?.id;

        const where: any = { mangaId, parentId: null };
        if (chapterId) where.chapterId = chapterId;

        const comments = await prisma.comment.findMany({
            where,
            include: {
                user: { select: { username: true, image: true } },
                chapter: { select: { number: true } },
                _count: {
                    select: {
                        replies: true,
                    }
                },
                votes: currentUserId ? {
                    where: { userId: currentUserId },
                    select: { type: true }
                } : false,
            },
        });

        const formattedComments = comments.map((c: any) => ({
            id: c.id,
            mangaId: c.mangaId,
            chapterId: c.chapterId,
            chapterNumber: c.chapter?.number || null,
            userId: c.userId,
            username: c.user?.username || 'Anonymous',
            userImage: c.user?.image,
            content: c.content,
            date: c.createdAt.toISOString(),
            parentId: c.parentId,
            likes: c.likesCount || 0,
            dislikes: c.dislikesCount || 0,
            userVote: c.votes?.[0]?.type || 0,
            replyCount: c._count.replies,
        }));

        // Sort on server
        let sorted = [...formattedComments];
        if (sortBy === 'best') {
            sorted.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
        } else if (sortBy === 'oldest') {
            sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        } else {
            sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return NextResponse.json(sorted);
    } catch (error) {
        console.error("Fetch comments error:", error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mangaId } = await Promise.resolve(params);
    // @ts-ignore
    const userId = session.user.id;
    const body = await req.json();

    if (!body.content) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Sanitize and validate comment content
    const sanitizedContent = body.content
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .trim();
    
    if (sanitizedContent.length === 0) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (sanitizedContent.length > 2000) {
        return NextResponse.json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
    }

    try {
        // Cooldown check (1 minute)
        const lastComment = await prisma.comment.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        if (lastComment) {
            const diff = (Date.now() - new Date(lastComment.createdAt).getTime()) / 1000;
            if (diff < 60) {
                const remaining = Math.ceil(60 - diff);
                return NextResponse.json({
                    error: `Please wait ${remaining} seconds before posting another comment.`
                }, { status: 429 });
            }
        }

        const comment = await prisma.comment.create({
            data: {
                mangaId,
                userId,
                content: sanitizedContent,
                parentId: body.parentId || null,
                chapterId: body.chapterId || null,
            },
            include: {
                user: { select: { username: true, image: true } },
                chapter: { select: { number: true } }
            }
        });

        return NextResponse.json({
            id: comment.id,
            mangaId: comment.mangaId,
            chapterId: comment.chapterId,
            chapterNumber: comment.chapter?.number || null,
            userId: comment.userId,
            username: comment.user?.username || 'Anonymous',
            userImage: comment.user?.image,
            content: comment.content,
            date: comment.createdAt.toISOString(),
            parentId: comment.parentId,
            likes: 0,
            dislikes: 0,
            userVote: 0,
            replyCount: 0
        });
    } catch (error) {
        console.error("Comment error:", error);
        return NextResponse.json({ error: 'Failed to post' }, { status: 500 });
    }
}
