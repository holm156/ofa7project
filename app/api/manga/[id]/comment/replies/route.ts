import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../lib/auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId');
    await Promise.resolve(params); // Added for consistency since id is unused but defined

    if (!parentId) {
        return NextResponse.json({ error: 'Parent ID is required' }, { status: 400 });
    }

    try {
        const session = await getServerSession(authOptions);
        // @ts-ignore
        const currentUserId = session?.user?.id;

        const replies = await prisma.comment.findMany({
            where: { parentId },
            include: {
                user: { select: { username: true, image: true } },
                chapter: { select: { number: true } },
                _count: {
                    select: {
                        replies: true,
                        votes: true,
                    }
                },
                votes: currentUserId ? {
                    where: { userId: currentUserId },
                    select: { type: true }
                } : false,
            },
            orderBy: { createdAt: 'asc' }
        });

        const replyIds = replies.map((c: any) => c.id);
        const allVotes = await prisma.commentVote.groupBy({
            by: ['commentId', 'type'],
            where: { commentId: { in: replyIds } },
            _count: true
        });

        const formatted = replies.map((c: any) => {
            const commentVotes = allVotes.filter(v => v.commentId === c.id);
            const likes = commentVotes.find(v => v.type === 1)?._count || 0;
            const dislikes = commentVotes.find(v => v.type === -1)?._count || 0;

            return {
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
                likes,
                dislikes,
                userVote: c.votes?.[0]?.type || 0,
                replyCount: c._count.replies,
            };
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error("Fetch replies error:", error);
        return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
    }
}
