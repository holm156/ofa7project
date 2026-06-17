import React from 'react';
import ProfileClient from '../../components/ProfileClient';
import { getMangas } from '../../lib/queries';
import { prisma } from '../../lib/db';
import { Chapter } from '../../types';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    // Get session to find user's history chapter IDs (avoid loading all 80k chapters)
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id;

    // Only fetch chapters for this user's reading history (max 10 items)
    let formattedChapters: Chapter[] = [];
    if (userId) {
        const userHistory = await prisma.history.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            take: 10,
            select: { chapterId: true }
        });

        if (userHistory.length > 0) {
            const chapterIds = userHistory.map((h: any) => h.chapterId).filter(Boolean);
            const dbChapters = await prisma.chapter.findMany({
                where: { id: { in: chapterIds } },
                select: {
                    id: true, mangaId: true, number: true, title: true,
                    releaseDate: true, freeDate: true, price: true, sourceName: true
                }
            });

            formattedChapters = dbChapters.map((c: any) => ({
                ...c,
                releaseDate: c.releaseDate?.toISOString() || new Date().toISOString(),
                freeDate: c.freeDate?.toISOString() || null,
                pages: [],
            })) as unknown as Chapter[];
        }
    }

    const mangas = await getMangas();

    return <ProfileClient initialMangas={mangas} initialChapters={formattedChapters} />;
}
