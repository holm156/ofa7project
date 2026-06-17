import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id) return NextResponse.json([], { status: 401 });

    try {
        // @ts-ignore
        const userId = session.user.id;
        const states = await prisma.notificationState.findMany({
            where: { userId }
        });
        return NextResponse.json(states);
    } catch (e) {
        console.error("Notifications GET Error:", e);
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // @ts-ignore
        const userId = session.user.id;
        const { notifId, isRead, isCleared } = await req.json();

        if (!notifId) return NextResponse.json({ error: 'notifId is required' }, { status: 400 });

        const state = await prisma.notificationState.upsert({
            where: {
                userId_notifId: { userId, notifId }
            },
            update: {
                isRead: isRead !== undefined ? isRead : undefined,
                isCleared: isCleared !== undefined ? isCleared : undefined
            },
            create: {
                userId,
                notifId,
                isRead: isRead || false,
                isCleared: isCleared || false
            }
        });

        return NextResponse.json(state);
    } catch (e) {
        console.error("Notifications POST Error:", e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
