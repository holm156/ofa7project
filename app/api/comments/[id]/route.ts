import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
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
    const currentUserId = session.user.id;
    // @ts-ignore
    const userRole = session.user.role;

    try {
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { userId: true }
        });

        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        // Authorization: Owner or Admin/Moderator
        const isOwner = comment.userId === currentUserId;
        const isAdmin = userRole === 'admin' || userRole === 'moderator';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.comment.delete({
            where: { id: commentId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete comment error:", error);
        return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }
}
