import { MetadataRoute } from 'next';
import { prisma } from '../lib/db';
import { unstable_cache } from 'next/cache';

// Force dynamic rendering — prevents build-time DB connection attempts
export const dynamic = 'force-dynamic';

// Cache the heavy sitemap generation for 6 hours (21600 seconds)
// This completely insulates the database from concurrent search engine crawlers (Google, Bing, etc.)
const getCachedSitemapData = unstable_cache(
    async () => {
        // 1. Fetch all manga slugs (usually under a few thousands, safe to fetch all)
        const mangas = await prisma.manga.findMany({
            select: { slug: true, updatedAt: true }
        });

        // 2. Fetch only the most recent 3000 chapters.
        // Old chapters are already indexed by search engines and are linked from the manga pages.
        // Crawlers only need the latest chapters to discover new updates quickly.
        const chapters = await prisma.chapter.findMany({
            select: {
                number: true,
                updatedAt: true,
                manga: { select: { slug: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 3000
        });

        return { mangas, chapters };
    },
    ['sitemap-xml-cache'],
    { revalidate: 21600 } // 6 hours
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://duskscans.com';

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        },
    ];

    try {
        const { mangas, chapters } = await getCachedSitemapData();

        const mangaPages: MetadataRoute.Sitemap = mangas.map((manga: any) => ({
            url: `${baseUrl}/series/${manga.slug}`,
            lastModified: new Date(manga.updatedAt),
            changeFrequency: 'weekly' as const,
            priority: 1,
        }));

        const chapterPages: MetadataRoute.Sitemap = chapters.map((chapter: any) => ({
            url: `${baseUrl}/series/${chapter.manga.slug}/chapter-${chapter.number}`,
            lastModified: new Date(chapter.updatedAt),
            changeFrequency: 'monthly' as const,
            priority: 1,
        }));

        return [...staticPages, ...mangaPages, ...chapterPages];
    } catch (e) {
        console.error("Sitemap generation error:", e);
        // If DB is unavailable, return only static pages
        return staticPages;
    }
}
