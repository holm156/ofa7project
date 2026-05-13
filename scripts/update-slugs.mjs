import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function main() {
    console.log('Starting clean slug migration...');
    const mangas = await prisma.manga.findMany();

    for (const manga of mangas) {
        let baseSlug = slugify(manga.title);
        if (!baseSlug) baseSlug = 'manga';

        let finalSlug = baseSlug;
        let counter = 1;

        // Check for collisions with OTHER mangas already updated or existing
        while (true) {
            const existing = await prisma.manga.findFirst({
                where: {
                    slug: finalSlug,
                    NOT: { id: manga.id }
                }
            });

            if (!existing) break;

            finalSlug = `${baseSlug}-${counter}`;
            counter++;
        }

        console.log(`Updating ${manga.title}: ${manga.slug} -> ${finalSlug}`);

        await prisma.manga.update({
            where: { id: manga.id },
            data: { slug: finalSlug }
        });
    }

    console.log('Migration completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
