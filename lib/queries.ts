import { prisma } from './db';
import { Manga, Chapter, Comment } from '../types';

export async function getMangas(): Promise<(Manga & { chapters: Chapter[] })[]> {
    try {
        const mangas = await prisma.manga.findMany({
            include: {
                viewHistory: {
                    where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                },
                genres: true,
                ratings: true,
                user: { select: { username: true } },
                chapters: {
                    orderBy: { number: 'desc' },
                    select: { id: true, title: true, number: true, releaseDate: true, freeDate: true, price: true, mangaId: true, sourceName: true } as any
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return mangas.map((m: any) => ({
            ...m,
            updatedAt: m.updatedAt?.toISOString() || new Date().toISOString(),
            chapters: m.chapters?.map((c: any) => ({
                ...c,
                releaseDate: c.releaseDate?.toISOString() || new Date().toISOString(),
                freeDate: c.freeDate?.toISOString() || null
            })) || [],
            genres: m.genres?.map((g: any) => g.name) || [],
            viewHistory: m.viewHistory?.map((vh: any) => vh.timestamp.getTime()) || [],
            userRatings: m.ratings || [],
            uploaderName: m.user?.username || 'System'
        })) as unknown as (Manga & { chapters: Chapter[] })[];
    } catch (error) {
        console.error("Error fetching mangas in queries.ts:", error);
        return [];
    }
}

export async function getMangaById(id: string): Promise<Manga | null> {
    try {
        const manga = await prisma.manga.findUnique({
            where: { id },
            include: {
                viewHistory: true,
                genres: true,
                ratings: true,
                user: { select: { username: true } }
            }
        });

        if (!manga) return null;

        return {
            ...manga,
            updatedAt: manga.updatedAt?.toISOString() || new Date().toISOString(),
            genres: manga.genres?.map((g: any) => g.name) || [],
            viewHistory: manga.viewHistory?.map((vh: any) => vh.timestamp.getTime()) || [],
            userRatings: manga.ratings || [],
            uploaderName: manga.user?.username || 'System'
        } as unknown as Manga;
    } catch (error) {
        console.error(`Error fetching manga ${id} in queries.ts:`, error);
        return null;
    }
}

export async function getMangaBySlug(slug: string): Promise<Manga | null> {
    try {
        const manga = await prisma.manga.findUnique({
            where: { slug },
            include: {
                viewHistory: true,
                genres: true,
                ratings: true,
                user: { select: { username: true } }
            }
        });

        if (!manga) return null;

        return {
            ...manga,
            updatedAt: manga.updatedAt?.toISOString() || new Date().toISOString(),
            genres: manga.genres?.map((g: any) => g.name) || [],
            viewHistory: manga.viewHistory?.map((vh: any) => vh.timestamp.getTime()) || [],
            userRatings: manga.ratings || [],
            uploaderName: manga.user?.username || 'System'
        } as unknown as Manga;
    } catch (error) {
        console.error(`Error fetching manga by slug ${slug} in queries.ts:`, error);
        return null;
    }
}

export async function getChaptersByMangaId(mangaId: string): Promise<Chapter[]> {
    try {
        const chapters = await prisma.chapter.findMany({
            where: { mangaId },
            orderBy: { number: 'desc' }
        });

        return chapters.map(c => {
            let pagesArr: string[] = [];
            try {
                pagesArr = typeof c.pages === 'string' ? JSON.parse(c.pages) : (Array.isArray(c.pages) ? c.pages : []);
            } catch (err) {
                console.error("JSON parse error for pages", err);
            }
            return {
                ...c,
                releaseDate: c.releaseDate?.toISOString() || new Date().toISOString(),
                freeDate: c.freeDate?.toISOString() || null,
                pages: Array.isArray(pagesArr) ? pagesArr : [],
                // We don't calculate isLocked here, permissions are checked per user request
            };
        }) as unknown as Chapter[];
    } catch (error) {
        console.error(`Error fetching chapters for manga ${mangaId}:`, error);
        return [];
    }
}

export async function getCommentsByMangaId(mangaId: string, chapterId?: string, currentUserId?: string, sortBy: 'newest' | 'oldest' | 'best' = 'best'): Promise<Comment[]> {
    try {
        const where: any = { mangaId, parentId: null };
        if (chapterId) where.chapterId = chapterId;

        const comments = await prisma.comment.findMany({
            where,
            include: {
                user: { select: { username: true, name: true, image: true, role: true } },
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
        });

        const formatted = await Promise.all(comments.map(async (c: any) => {
            const votes = await prisma.commentVote.groupBy({
                by: ['type'],
                where: { commentId: c.id },
                _count: true
            });

            const likes = votes.find(v => v.type === 1)?._count || 0;
            const dislikes = votes.find(v => v.type === -1)?._count || 0;

            return {
                id: c.id,
                mangaId: c.mangaId,
                chapterId: c.chapterId,
                chapterNumber: c.chapter?.number,
                userId: c.userId,
                username: c.user?.username || c.user?.name || 'Unknown',
                userImage: c.user?.image,
                content: c.content,
                date: c.createdAt?.toISOString() || new Date().toISOString(),
                parentId: c.parentId,
                likes,
                dislikes,
                userVote: c.votes?.[0]?.type || 0,
                replyCount: c._count.replies,
            };
        }));

        // Sort on server
        if (sortBy === 'best') {
            formatted.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
        } else if (sortBy === 'oldest') {
            formatted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        } else {
            formatted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return formatted as unknown as Comment[];

        return formatted as unknown as Comment[];
    } catch (error) {
        console.error(`Error fetching comments for manga ${mangaId}:`, error);
        return [];
    }
}

export async function getChapterByNumber(mangaId: string, number: number): Promise<Chapter | null> {
    try {
        const chapter = await prisma.chapter.findUnique({
            where: {
                mangaId_number: {
                    mangaId,
                    number
                }
            }
        });

        if (!chapter) return null;

        let pagesArr: string[] = [];
        try {
            pagesArr = typeof chapter.pages === 'string' ? JSON.parse(chapter.pages) : (Array.isArray(chapter.pages) ? chapter.pages : []);
        } catch (err) {
            console.error("JSON parse error for pages", err);
        }

        return {
            ...chapter,
            releaseDate: chapter.releaseDate?.toISOString() || new Date().toISOString(),
            freeDate: chapter.freeDate?.toISOString() || null,
            pages: Array.isArray(pagesArr) ? pagesArr : [],
        } as unknown as Chapter;
    } catch (error) {
        console.error(`Error fetching chapter ${number} for manga ${mangaId}:`, error);
        return null;
    }
}
export async function getRelatedMangas(mangaId: string, genres: string[], limit: number = 10): Promise<Manga[]> {
    try {
        const related = await prisma.manga.findMany({
            where: {
                id: { not: mangaId },
                genres: {
                    some: {
                        name: { in: genres }
                    }
                }
            },
            take: limit,
            include: {
                chapters: {
                    orderBy: { number: 'desc' },
                    take: 1
                },
                genres: true,
                ratings: true
            },
            orderBy: { views: 'desc' }
        });

        return related.map((m: any) => ({
            ...m,
            updatedAt: m.updatedAt?.toISOString() || new Date().toISOString(),
            chapters: m.chapters?.map((c: any) => ({
                ...c,
                releaseDate: c.releaseDate?.toISOString() || new Date().toISOString(),
                freeDate: c.freeDate?.toISOString() || null
            })) || [],
            genres: m.genres?.map((g: any) => g.name) || [],
            userRatings: m.ratings || []
        })) as unknown as Manga[];
    } catch (error) {
        console.error(`Error fetching related mangas for ${mangaId}:`, error);
        return [];
    }
}
