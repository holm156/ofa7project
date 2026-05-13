import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await Promise.resolve(params);

    if (!userId) {
        return NextResponse.json({ error: 'User ID is missing from path' }, { status: 400 });
    }

    try {
        const unlockedChapters = await prisma.unlockedChapter.findMany({
            where: {
                user: {
                    id: userId
                }
            },
            include: {
                chapter: {
                    include: {
                        manga: {
                            select: {
                                title: true,
                                id: true
                            }
                        }
                    }
                }
            } as any
        });

        return NextResponse.json(unlockedChapters);
    } catch (e) {
        console.error("Admin User Chapters GET Error:", e);
        return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await Promise.resolve(params);
    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get('chapterId');

    if (!chapterId) {
        return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 });
    }

    try {
        await prisma.unlockedChapter.deleteMany({
            where: {
                userId,
                chapterId
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Admin User Chapters DELETE Error:", e);
        return NextResponse.json({ error: 'Failed to remove chapter' }, { status: 500 });
    }
}
