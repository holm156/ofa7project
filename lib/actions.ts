"use server";

import { prisma } from './db';

export async function searchMangasAction(query: string) {
    if (!query || query.trim() === '') return [];

    try {
        const results = await prisma.manga.findMany({
            where: {
                title: {
                    contains: query
                }
            },
            select: {
                id: true,
                title: true,
                cover: true,
                rating: true,
                status: true,
                slug: true
            },
            take: 5
        });

        return results;
    } catch (error) {
        console.error("Search Server Action Error:", error);
        return [];
    }
}
