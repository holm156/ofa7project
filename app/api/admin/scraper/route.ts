import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from "@/lib/db";
import { randomUUID } from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import sharp from 'sharp';
import { isWasabiConfigured, uploadBufferToWasabi } from '@/lib/wasabi';
import { notifyNewChapter } from '@/lib/discord';

const WEBP_MAX_DIMENSION = 16383;

async function convertImage(input: Buffer, quality = 80): Promise<{ buffer: Buffer; ext: string }> {
    const meta = await sharp(input, { limitInputPixels: false }).metadata();

    // If it's a GIF, keep it as is to preserve animation
    if (meta.format === 'gif') {
        return { buffer: input, ext: 'gif' };
    }

    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    if (w <= WEBP_MAX_DIMENSION && h <= WEBP_MAX_DIMENSION) {
        const buffer = await sharp(input, { limitInputPixels: false }).webp({ quality }).toBuffer();
        return { buffer, ext: 'webp' };
    }

    const buffer = await sharp(input, { limitInputPixels: false }).png({ compressionLevel: 6 }).toBuffer();
    return { buffer, ext: 'png' };
}

const getContentTypeByExt = (ext: string): string => {
    switch (ext.toLowerCase()) {
        case 'webp':
            return 'image/webp';
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'gif':
            return 'image/gif';
        default:
            return 'application/octet-stream';
    }
}

async function scrapeSingleUrl(url: string, mangaId: string, chapterNumber: string, chapterTitle: string, autoPublish: boolean, sourceName?: string, sourceColor?: string) {
    const imageUrls: string[] = [];

    // --- SPECIAL HANDLER FOR GOJOSCANS (CSR API TEMPLATE) ---
    if (url.includes('gojoscans.com')) {
        try {
            // Transform https://gojoscans.com/series/NAME/chapters/ch-1 
            // into https://api.gojoscans.com/api/series/NAME/chapters/ch-1
            const apiUrl = url.replace('gojoscans.com', 'api.gojoscans.com/api');
            const apiRes = await axios.get(apiUrl, { timeout: 15000 });

            const chapterData = apiRes.data?.data?.chapter;
            if (chapterData) {
                const content = chapterData.content || chapterData.images || [];
                if (Array.isArray(content)) {
                    content.forEach((item: any) => {
                        const img = typeof item === 'string' ? item : (item.image_url || item.url);
                        if (img && typeof img === 'string') {
                            if (!imageUrls.includes(img)) imageUrls.push(img.trim());
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`Failed to fetch GojoScans API for ${url}`);
        }
    }

    // Fetch the HTML page (Standard fallback for ThunderScans and others)
    let html = '';
    if (imageUrls.length === 0) {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });
        html = response.data;
    }

    const $ = cheerio.load(html || '<html/>');

    const containers = [
        '.reader-area img',
        '.wp-manga-chapter-img',
        '#readerarea img',
        '.vung-doc img',
        '.container-chapter-reader img',
        '.read-container img',
        '.chapter-content img',
        '#chapter-video-frame img'
    ];

    // 1. JSON Extraction (Essential for MangaReader themes like ThunderScans)
    const jsonMatch = html.match(/"images"\s*:\s*(\[[^\]]+\])/i) ||
        html.match(/var\s+ts_reader_control\s*=\s*({[^;]+})/i);

    if (jsonMatch) {
        try {
            const rawData = jsonMatch[1].trim();
            const data = JSON.parse(rawData);
            let foundImages = data.images || (data.sources && data.sources[0]?.images);

            // If the regex captured the array directly (e.g., ["url1", "url2"])
            if (Array.isArray(data)) {
                foundImages = data;
            }

            if (Array.isArray(foundImages)) {
                foundImages.forEach((img: string) => {
                    if (img && typeof img === 'string') {
                        const cleanImg = img.trim();
                        if (!imageUrls.includes(cleanImg)) imageUrls.push(cleanImg);
                    }
                });
            }
        } catch (e) { }
    }

    // 2. Standard HTML Extraction (If JSON fails or returns few images)
    if (imageUrls.length < 5) {
        for (const selector of containers) {
            $(selector).each((_, img) => {
                const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
                if (src && !imageUrls.includes(src)) {
                    imageUrls.push(src.trim());
                }
            });
            if (imageUrls.length > 0) break;
        }
    }

    // 3. Fallback HTML Extraction
    if (imageUrls.length === 0) {
        $('img').each((_, img) => {
            const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
            if (src && (src.includes('chapter') || src.includes('manga') || src.match(/\d+.*\.(jpg|png|webp|jpeg)/i))) {
                if (!imageUrls.includes(src)) {
                    imageUrls.push(src.trim());
                }
            }
        });
    }

    if (imageUrls.length === 0) throw new Error(`No images found on ${url}`);

    const baseUrl = new URL(url).origin;
    let candidateUrls = imageUrls.map(imgUrl => {
        if (imgUrl.startsWith('//')) return `https:${imgUrl}`;
        if (imgUrl.startsWith('/')) return `${baseUrl}${imgUrl}`;
        return imgUrl;
    });

    // --- HEIGHT FILTER (Keep only images taller than 400px) ---
    // This allows spliced images while still filtering out small icons or ads.
    const finalImageUrls: string[] = [];
    for (const imgUrl of candidateUrls) {
        try {
            const res = await axios.get(imgUrl, {
                responseType: 'arraybuffer',
                headers: { 'Referer': baseUrl },
                timeout: 8000 // Short timeout to quickly skip broken images
            });
            const buffer = Buffer.from(res.data, 'binary');
            const meta = await sharp(buffer, { limitInputPixels: false }).metadata();

            // Only keep images taller than 400 pixels (standard for most content slices)
            if (meta.height && meta.height >= 400) {
                finalImageUrls.push(imgUrl);
            }
        } catch (error) {
            console.error(`Failed to check dimensions for ${imgUrl}`);
        }
    }

    if (finalImageUrls.length === 0) throw new Error(`No content images found on ${url} (Filtered out images smaller than 400px height)`);

    if (!autoPublish) return { images: finalImageUrls };

    // Download and Publish
    const manga = await prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) throw new Error('Manga not found');

    const mangaSlug = manga.slug || 'manga';
    const chapterFolder = `uploads/chapters/${mangaSlug}/ch_${chapterNumber}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const useWasabi = isWasabiConfigured();
    let uploadDir = '';
    if (!useWasabi) {
        const publicDir = path.join(process.cwd(), 'public');
        uploadDir = path.join(publicDir, chapterFolder);
        await mkdir(uploadDir, { recursive: true });
    }

    const localPages: string[] = [];
    for (let i = 0; i < finalImageUrls.length; i++) {
        try {
            const imgRes = await axios.get(finalImageUrls[i], {
                responseType: 'arraybuffer',
                headers: { 'Referer': new URL(url).origin }
            });
            const { buffer, ext } = await convertImage(Buffer.from(imgRes.data));
            const filename = `${(i + 1).toString().padStart(3, '0')}.${ext}`;
            if (useWasabi) {
                const objectKey = `${chapterFolder}/${filename}`;
                const uploadedUrl = await uploadBufferToWasabi(objectKey, buffer, getContentTypeByExt(ext));
                localPages.push(uploadedUrl);
            } else {
                const filepath = path.join(uploadDir, filename);
                await writeFile(filepath, buffer);
                localPages.push(`/api/${chapterFolder}/${filename}`);
            }
        } catch (err) {
            console.error(`Failed to download image from ${finalImageUrls[i]}`);
        }
    }

    if (localPages.length === 0) throw new Error('Failed to download images');

    const chapter = await prisma.chapter.create({
        data: {
            id: randomUUID(),
            mangaId: mangaId,
            title: chapterTitle || `Chapter ${chapterNumber}`,
            number: parseFloat(chapterNumber),
            pages: JSON.stringify(localPages),
            sourceName: sourceName,
            sourceColor: sourceColor,
            updatedAt: new Date()
        } as any
    });

    await prisma.manga.update({
        where: { id: mangaId },
        data: {
            updatedAt: new Date(),
            chapterCount: { increment: 1 }
        }
    });

    // Notify Discord (Using existing webhooks in .env)
    try {
        await notifyNewChapter(manga, chapter, 'Auto Scraper');
    } catch (discordErr) {
        console.error("Failed to notify Discord:", discordErr);
    }

    // Find Next Chapter URL
    let nextUrl = '';
    const nextSelectors = [
        'a.next_page',
        'a.next-chapter',
        'a.ch-next',
        'a:contains("Next")',
        'a:contains("Next")',
        'link[rel="next"]'
    ];

    for (const sel of nextSelectors) {
        const link = sel.includes(':contains') ? $(sel) : $(sel).first();
        const href = link.attr('href');
        if (href) {
            nextUrl = href.startsWith('http') ? href : (href.startsWith('//') ? `https:${href}` : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`);
            break;
        }
    }

    return { success: true, chapterId: chapter.id, imagesCount: localPages.length, images: localPages, nextUrl };
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
        const job = await prisma.scraperJob.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        let parsedResults = null;
        if (job.results) {
            try { parsedResults = JSON.parse(job.results); } catch (e) { parsedResults = job.results; }
        }

        return NextResponse.json({
            id: job.id,
            status: job.status,
            progress: job.progress,
            error: job.error,
            results: parsedResults
        });
    }

    // If no jobId, return recent jobs
    const recentJobs = await prisma.scraperJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(recentJobs.map(job => {
        let parsedResults = null;
        if (job.results) {
            try { parsedResults = JSON.parse(job.results); } catch (e) { parsedResults = job.results; }
        }
        return {
            ...job,
            results: parsedResults
        };
    }));
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { urls, mangaId, chapterNumber, chapterTitle, sourceName, sourceColor, autoPublish, isBulk } = await req.json();

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'URLs are required' }, { status: 400 });
        }

        // Create a new background job
        const job = await prisma.scraperJob.create({
            data: {
                status: 'processing',
                progress: 0
            }
        });

        // Start the background process (DO NOT await)
        (async () => {
            const results: any[] = [];
            let baseChapterNum = parseFloat(chapterNumber) || 1;

            try {
                for (let i = 0; i < urls.length; i++) {
                    const url = urls[i];
                    const currentChapterNum = (baseChapterNum + i).toString();

                    // Update progress
                    await prisma.scraperJob.update({
                        where: { id: job.id },
                        data: { progress: Math.floor((i / urls.length) * 100) }
                    });

                    // Add delay for bulk requests (except the first one)
                    if (i > 0) {
                        console.log(`Waiting 3 second before scraping next chapter: ${url}...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    try {
                        const res = await scrapeSingleUrl(
                            url,
                            mangaId,
                            isBulk ? currentChapterNum : chapterNumber,
                            isBulk ? `${chapterTitle || 'Chapter'} ${currentChapterNum}` : chapterTitle,
                            autoPublish,
                            sourceName,
                            sourceColor
                        );
                        results.push({ url, ...res });
                    } catch (err: any) {
                        results.push({ url, error: err.message });
                    }
                }

                const successCount = results.filter(r => r.success === true).length;
                const hasImages = !isBulk && results[0]?.images && results[0].images.length > 0;

                const finalResults = {
                    success: autoPublish && successCount > 0,
                    results,
                    images: hasImages ? results[0].images : undefined,
                    imagesCount: results.reduce((acc: number, r: any) => acc + (r.imagesCount || 0), 0)
                };

                // Mark job as completed
                await prisma.scraperJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'completed',
                        progress: 100,
                        results: JSON.stringify(finalResults)
                    }
                });
            } catch (err: any) {
                console.error("Background Scraper Error:", err);
                await prisma.scraperJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'failed',
                        error: err.message || 'Scraper failed'
                    }
                });
            }
        })();

        // Return the jobId immediately
        return NextResponse.json({
            message: 'Scraping started in background',
            jobId: job.id
        });

    } catch (e: any) {
        console.error("Scraper POST Error:", e);
        return NextResponse.json({ error: e.message || 'Failed to start scraper' }, { status: 500 });
    }
}
