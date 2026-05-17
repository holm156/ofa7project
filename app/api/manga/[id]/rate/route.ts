import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { randomUUID } from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";

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
    const { rating } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    try {
        // 0. Check for cooldown (1 minute)
        const existingRating = await prisma.rating.findUnique({
            where: { userId_mangaId: { userId, mangaId } },
            select: { updatedAt: true }
        });

        if (existingRating) {
            const lastUpdate = new Date(existingRating.updatedAt).getTime();
            const now = Date.now();
            const diffInSeconds = (now - lastUpdate) / 1000;

            if (diffInSeconds < 60) {
                const remaining = Math.ceil(60 - diffInSeconds);
                return NextResponse.json({
                    error: `Please wait ${remaining} seconds before changing your rating again.`
                }, { status: 429 });
            }
        }

        // 1. Upsert rating
        await prisma.rating.upsert({
            where: { userId_mangaId: { userId, mangaId } },
            update: { rating },
            create: { id: randomUUID(), userId, mangaId, rating }
        });

        // 2. Recalculate average using DB aggregation
        const agg = await prisma.rating.aggregate({
            where: { mangaId },
            _avg: { rating: true }
        });

        const average = agg._avg.rating || rating;

        const updatedManga = await prisma.manga.update({
            where: { id: mangaId },
            data: { rating: average }
        });

        return NextResponse.json({ rating: updatedManga.rating });
    } catch (error) {
        console.error("Rating error:", error);
        return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 });
    }
}
