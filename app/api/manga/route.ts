import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { randomUUID } from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { generateSlug } from '../../../lib/slug';

import { getMangas, getMangasByIds } from '../../../lib/queries';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    
    if (idsParam) {
        const ids = idsParam.split(',').filter(Boolean);
        const mangas = await getMangasByIds(ids);
        return NextResponse.json(mangas);
    }

    const mangas = await getMangas();
    return NextResponse.json(mangas);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
  // Security Check
  // Only admins and moderators can create manga
  // @ts-ignore
  if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const genres = Array.isArray(body.genres) ? body.genres : [];

    const manga = await prisma.manga.create({
      data: {
        title: body.title,
        alternativeTitle: body.alternativeTitle || null,
        cover: body.cover,
        backgroundImage: body.backgroundImage,
        description: body.description,
        author: body.author,
        status: body.status,
        type: body.type,
        isFeatured: body.isFeatured || false,
        releaseYear: body.releaseYear || '2025',
        discordRoleId: body.discordRoleId || null,
        views: body.views || 0,
        updatedAt: body.updatedAt ? new Date(body.updatedAt) : undefined,
        slug: generateSlug(body.title),
        // @ts-ignore
        userId: session.user.id,
        genres: {
          connectOrCreate: genres.map((g: string) => ({
            where: { name: g },
            create: { name: g }
          }))
        }
      },
      include: {
        genres: true,
        ratings: true
      }
    }) as any;

    const formatted = {
      ...manga,
      genres: manga.genres?.map((g: any) => g.name) || [],
      userRatings: manga.ratings || [],
      viewHistory: []
    };

    return NextResponse.json(formatted);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}