import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id) return NextResponse.json(null);

    // @ts-ignore
    const userId = session.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                bookmarks: true,
                history: {
                    orderBy: { timestamp: 'desc' },
                    take: 10
                },
                unlockedChapters: true,
                accounts: true
            } as any
        }) as any;

        if (!user) return NextResponse.json(null);

        return NextResponse.json({
            id: user.id,
            username: user.username || user.name,
            email: user.email,
            role: user.role,
            coins: user.coins,
            image: user.image,
            linkedAccounts: (user.accounts || []).map((a: any) => a.provider),
            hasPassword: !!user.password,
            updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
            notificationsEnabled: user.notificationsEnabled ?? true,
            commentRepliesEnabled: user.commentRepliesEnabled ?? true,
            likeNotificationsEnabled: user.likeNotificationsEnabled ?? true,
            // Map relation objects to IDs for frontend
            bookmarks: (user.bookmarks || []).map((b: any) => b.mangaId),
            detailedBookmarks: (user.bookmarks || []).map((b: any) => ({
                mangaId: b.mangaId,
                createdAt: b.createdAt.toISOString()
            })),
            history: (user.history || []).map((h: any) => ({
                mangaId: h.mangaId,
                chapterId: h.chapterId,
                timestamp: h.timestamp.getTime()
            })),
            unlockedChapters: (user.unlockedChapters || []).map((u: any) => u.chapterId)
        });
    } catch (e) {
        console.error("Profile GET Error:", e);
        return NextResponse.json(null, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // @ts-ignore
    const userId = session.user.id;
    const body = await req.json();
    console.log("Profile PUT Request:", { userId, body });

    try {
        // Handle Bookmarks Update
        if (body.bookmarks) {
            // Transaction: Delete all old bookmarks for this user, insert new ones
            // This is safer to keep sync with frontend state
            await prisma.$transaction([
                prisma.bookmark.deleteMany({ where: { userId } }),
                prisma.bookmark.createMany({
                    data: body.bookmarks.map((mangaId: string) => ({
                        id: randomUUID(),
                        userId,
                        mangaId
                    })),
                    skipDuplicates: true
                })
            ]);
        }

        // Handle History Update (Add single item usually)
        if (body.historyItem) {
            const { mangaId, chapterId } = body.historyItem;
            try {
                await prisma.$transaction(async (tx) => {
                    // 1. Delete any existing history for this manga for this user to ensure uniqueness
                    await tx.history.deleteMany({
                        where: { userId, mangaId }
                    });

                    // 2. Create the new history entry
                    await tx.history.create({
                        data: {
                            id: randomUUID(),
                            userId,
                            mangaId,
                            chapterId,
                            timestamp: new Date()
                        }
                    });

                    // 3. Get all history entries for this user, ordered by timestamp desc
                    const history = await tx.history.findMany({
                        where: { userId },
                        orderBy: { timestamp: 'desc' },
                        select: { id: true }
                    });

                    // 4. If more than 10, delete the oldest ones
                    if (history.length > 10) {
                        const idsToDelete = history.slice(10).map(h => h.id);
                        await tx.history.deleteMany({
                            where: { id: { in: idsToDelete } }
                        });
                    }
                });
            } catch (historyError) {
                console.error("History Update Transaction Error:", historyError);
                // We don't necessarily want to fail the whole profile update if history fails
                // But in this case, it's usually the only thing being updated
            }
        }

        // Handle Profile Updates (username, password, image)
        const updateData: any = {};

        // Security check for sensitive changes
        const currentPasswordRequired = !!body.password;

        if (currentPasswordRequired || (body.username && body.currentPassword)) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            // Only require current password if the user ALREADY has one set
            const userHasExistingPassword = !!user.password;

            if (userHasExistingPassword) {
                if (!body.currentPassword && currentPasswordRequired) {
                    return NextResponse.json({ error: 'Current password is required to change your password' }, { status: 400 });
                }

                if (body.currentPassword) {
                    const bcrypt = require('bcryptjs');
                    const isMatch = await bcrypt.compare(body.currentPassword, user.password);
                    if (!isMatch) {
                        return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
                    }
                }
            }
        }

        if (body.username) updateData.username = body.username;
        if (body.password) {
            if (body.password.length < 6) {
                return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
            }
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(body.password, 10);
            updateData.password = hashedPassword;
        }

        if (body.image) updateData.image = body.image;
        
        // Notifications
        if (typeof body.notificationsEnabled === 'boolean') updateData.notificationsEnabled = body.notificationsEnabled;
        if (typeof body.commentRepliesEnabled === 'boolean') updateData.commentRepliesEnabled = body.commentRepliesEnabled;
        if (typeof body.likeNotificationsEnabled === 'boolean') updateData.likeNotificationsEnabled = body.likeNotificationsEnabled;

        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
                where: { id: userId },
                data: updateData
            });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Profile PUT Error Details:", e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
