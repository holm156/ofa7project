import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

// Simple in-memory rate limiter for views
const viewLimitMap = new Map<string, number>();
const VIEW_COOLDOWN_MS = 30 * 1000; // 30 seconds per manga per IP

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const { id: mangaId } = await Promise.resolve(params);

    // Rate limit by IP + mangaId
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const key = `${ip}:${mangaId}`;
    const lastView = viewLimitMap.get(key);
    const now = Date.now();

    if (lastView && (now - lastView) < VIEW_COOLDOWN_MS) {
        return NextResponse.json({ success: true }); // Silently ignore
    }
    viewLimitMap.set(key, now);

    // Cleanup old entries periodically
    if (viewLimitMap.size > 5000) {
        viewLimitMap.forEach((time, k) => {
            if (now - time > VIEW_COOLDOWN_MS) viewLimitMap.delete(k);
        });
    }

    try {
        // 1. Increment views
        await (prisma as any).manga.update({
            where: { id: mangaId },
            data: { views: { increment: 1 } } as any
        } as any);

        // 2. Log view history for trending calculation
        await (prisma as any).viewHistory.create({
            data: { mangaId }
        } as any);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("View increment error:", error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
