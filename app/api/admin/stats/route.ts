import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin permissions
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true }
  });

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. User statistics
    const [totalUsers, newUsers30d] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ]);

    // 2. Revenue and sales statistics
    const revenueStats = await prisma.coinTransaction.aggregate({
      where: { type: 'PURCHASE' },
      _sum: { amount: true }
    });

    const spendingStats = await prisma.coinTransaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });

    // 3. Most read manga (Top 5)
    const topViews = await prisma.viewHistory.groupBy({
      by: ['mangaId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const topMangaDetails = await Promise.all(
      topViews.map(async (v) => {
        const manga = await prisma.manga.findUnique({
          where: { id: v.mangaId },
          select: { title: true, slug: true, cover: true }
        });
        return { ...manga, views: v._count.id };
      })
    );

    // 4. Chapter statistics
    const totalChapters = await prisma.chapter.count();
    const unlockedChaptersCount = await prisma.unlockedChapter.count();

    return NextResponse.json({
      users: {
        total: totalUsers,
        new30d: newUsers30d
      },
      revenue: {
        totalPurchased: revenueStats._sum.amount || 0,
        totalSpent: Math.abs(spendingStats._sum.amount || 0)
      },
      content: {
        totalChapters,
        totalUnlocks: unlockedChaptersCount
      },
      topManga: topMangaDetails
    });

  } catch (error) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
