import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: commentId } = await Promise.resolve(params);
    // @ts-ignore
    const userId = session.user.id;
    const { type } = await req.json(); // 1 for like, -1 for dislike, 0 to remove

    if (![1, -1, 0].includes(type)) {
        return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    try {
        const result = await (prisma as any).$transaction(async (tx: any) => {
            // 1. Get existing vote
            const existingVote = await tx.commentVote.findUnique({
                where: { userId_commentId: { userId, commentId } }
            });

            if (type === 0) {
                if (existingVote) {
                    // Remove vote
                    await tx.commentVote.delete({
                        where: { userId_commentId: { userId, commentId } }
                    });

                    // Update counts
                    const updateData: any = {};
                    if (existingVote.type === 1) updateData.likesCount = { decrement: 1 };
                    else if (existingVote.type === -1) updateData.dislikesCount = { decrement: 1 };

                    await tx.comment.update({
                        where: { id: commentId },
                        data: updateData
                    });
                }
            } else {
                // Upsert vote
                await tx.commentVote.upsert({
                    where: { userId_commentId: { userId, commentId } },
                    update: { type },
                    create: { userId, commentId, type }
                });

                // Update counts on Comment table
                const updateData: any = {};
                if (!existingVote) {
                    // New vote
                    if (type === 1) updateData.likesCount = { increment: 1 };
                    else if (type === -1) updateData.dislikesCount = { increment: 1 };
                } else if (existingVote.type !== type) {
                    // Changed vote
                    if (type === 1) {
                        updateData.likesCount = { increment: 1 };
                        updateData.dislikesCount = { decrement: 1 };
                    } else if (type === -1) {
                        updateData.dislikesCount = { increment: 1 };
                        updateData.likesCount = { decrement: 1 };
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    await tx.comment.update({
                        where: { id: commentId },
                        data: updateData
                    });
                }
            }

            // 2. Return updated counts from Comment table directly
            const updatedComment = await tx.comment.findUnique({
                where: { id: commentId },
                select: { likesCount: true, dislikesCount: true }
            });

            return updatedComment;
        });

        return NextResponse.json({
            likes: result.likesCount,
            dislikes: result.dislikesCount,
            userVote: type
        });
    } catch (error) {
        console.error("Vote error:", error);
        return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
    }
}
