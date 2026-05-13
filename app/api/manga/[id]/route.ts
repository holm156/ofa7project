import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import crypto from 'crypto';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // Only admins can modify/delete manga
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    try {
        const body = await req.json();

        // Update genres mapping if provided
        const updateData: any = {
            title: body.title,
            cover: body.cover,
            backgroundImage: body.backgroundImage,
            description: body.description,
            author: body.author,
            status: body.status,
            type: body.type,
            isFeatured: body.isFeatured,
            discordRoleId: body.discordRoleId,
            releaseYear: body.releaseYear,
            slug: body.slug // Allow manual slug update if needed
        };

        if (body.genres) {
            updateData.genres = {
                set: [], // Clear relations
                connectOrCreate: body.genres.map((g: string) => ({
                    where: { name: g },
                    create: { id: crypto.randomUUID(), name: g }
                }))
            };
        }

        const manga = await prisma.manga.update({
            where: { id },
            data: updateData,
            include: {
                genres: true,
                ratings: true
            }
        }) as any;

        const formatted = {
            ...manga,
            genres: manga.genres?.map((g: any) => g.name) || [],
            userRatings: manga.ratings || []
        };

        return NextResponse.json(formatted);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // Only admins can modify/delete manga
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    try {
        await prisma.manga.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
