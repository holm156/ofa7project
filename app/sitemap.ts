import { MetadataRoute } from 'next';
import { prisma } from '../lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://duskscans.com';

    // 1. القائمة الأساسية
    const staticPages = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        },
    ];

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
    // ملاحظة: لو عندك عدد هائل من الشباتر (أكتر من 40 ألف)، يفضل تقسيم الـ sitemap
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
}
