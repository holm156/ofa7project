import { MetadataRoute } from 'next';
import { prisma } from '../lib/db';

// Force dynamic rendering — prevents build-time DB connection attempts
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://duskscans.com';

    // 1. القائمة الأساسية
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        },
    ];

    try {
        // 2. سحب كل المانجا من الداتا بيز
        const mangas = await prisma.manga.findMany({
            select: { slug: true, updatedAt: true }
        });

        const mangaPages: MetadataRoute.Sitemap = mangas.map((manga: any) => ({
            url: `${baseUrl}/series/${manga.slug}`,
            lastModified: manga.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 1,
        }));

        // 3. سحب كل الشباتر من الداتا بيز
        const chapters = await prisma.chapter.findMany({
            select: {
                number: true,
                updatedAt: true,
                manga: { select: { slug: true } }
            }
        });

        const chapterPages: MetadataRoute.Sitemap = chapters.map((chapter: any) => ({
            url: `${baseUrl}/series/${chapter.manga.slug}/chapter-${chapter.number}`,
            lastModified: chapter.updatedAt,
            changeFrequency: 'monthly' as const,
            priority: 1,
        }));

        return [...staticPages, ...mangaPages, ...chapterPages];
    } catch {
        // If DB is unavailable, return only static pages
        return staticPages;
    }
}
