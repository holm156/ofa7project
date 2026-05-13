import React from 'react';
import ProfileClient from '../../components/ProfileClient';
import { getMangas } from '../../lib/queries';
import { prisma } from '../../lib/db';
import { Chapter } from '../../types';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    // Fetch mangas and all chapters concurrently
    const [mangas, dbChapters] = await Promise.all([
        getMangas(),
        prisma.chapter.findMany()
    ]);

    // Format Prisma chapters to match the frontend Chapter type (parsing JSON pages and date strings)
    const formattedChapters = dbChapters.map((c: any) => {
        let pagesArr: string[] = [];
        try {
            pagesArr = typeof c.pages === 'string' ? JSON.parse(c.pages) : (Array.isArray(c.pages) ? c.pages : []);
        } catch (err) {
            console.error("JSON parse error for pages in ProfilePage", err);
        }
        return {
            ...c,
            releaseDate: c.releaseDate?.toISOString() || new Date().toISOString(),
            freeDate: c.freeDate?.toISOString() || null,
            pages: Array.isArray(pagesArr) ? pagesArr : [],
        };
    }) as unknown as Chapter[];

    return <ProfileClient initialMangas={mangas} initialChapters={formattedChapters} />;
}
