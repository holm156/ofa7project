import { getMangaById, getChaptersByMangaId } from '../../../../lib/queries';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReaderPage({ params }: { params: Promise<{ mangaId: string, chapterId: string }> | { mangaId: string, chapterId: string } }) {
    const { mangaId, chapterId } = await Promise.resolve(params);

    const [manga, chapters] = await Promise.all([
        getMangaById(mangaId),
        getChaptersByMangaId(mangaId)
    ]);

    if (!manga || !chapters.length) {
        return <div className="text-center py-20 text-white font-bold text-xl">Manga or Chapters not found</div>;
    }

    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) {
        redirect(`/series/${manga.slug}`);
    }

    redirect(`/series/${manga.slug}/chapter-${chapter.number}`);
}