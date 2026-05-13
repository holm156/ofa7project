import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { randomUUID } from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { notifyCoinTransaction } from '../../../lib/discord';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { chapterId, price } = await req.json();
  // @ts-ignore
  const userId = session.user.id;

  try {
    // Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get User
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      // 2. Get Chapter and Manga details (Server-side Source of Truth)
      const chapter = await tx.chapter.findUnique({
        where: { id: chapterId },
        include: { manga: { select: { title: true } } }
      });
      if (!chapter) throw new Error("Chapter not found");

      // 3. Determine actual price (Source of Truth)
      const isFreeByTime = chapter.freeDate && new Date() > new Date(chapter.freeDate);
      const actualPrice = isFreeByTime ? 0 : (chapter.price || 0);

      // 4. Check if already unlocked (Extra safety)
      const exists = await tx.unlockedChapter.findUnique({
        where: { userId_chapterId: { userId, chapterId } }
      });
      if (exists) return { success: true, alreadyOwned: true };

      // 5. Check balance
      if (user.coins < actualPrice) throw new Error("Insufficient funds");

      // 6. Deduct coins & Unlock (Only if price > 0)
      if (actualPrice > 0) {
        // We use a guard to ensure coins don't go below 0
        const updatedUser = await tx.user.update({
          where: { id: userId, coins: { gte: actualPrice } },
          data: { coins: { decrement: actualPrice } }
        });
        if (!updatedUser) throw new Error("Insufficient funds (concurrently)");
      }

      try {
        await tx.unlockedChapter.create({
          data: { id: randomUUID(), userId, chapterId, createdAt: new Date() }
        });
      } catch (e: any) {
        // If unique constraint fails, it means it was unlocked concurrently
        if (e.code === 'P2002') return { success: true, alreadyOwned: true };
        throw e;
      }

      const description = `Unlocked Chapter ${chapter.number} of ${chapter.manga.title}`;

      // 7. Log Transaction (Only if price > 0)
      if (actualPrice > 0) {
        await (tx as any).coinTransaction.create({
          data: {
            userId,
            amount: -actualPrice,
            balanceAfter: user.coins - actualPrice,
            type: "PURCHASE",
            description: description
          }
        });
      }

      return { success: true, newBalance: user.coins - actualPrice, user, description, actualPrice };
    });

    if (result.success && !result.alreadyOwned && (result.actualPrice ?? 0) > 0) {
      // Notify Discord outside transaction
      notifyCoinTransaction(
        result.user as any,
        -(result.actualPrice ?? 0),
        "PURCHASE",
        result.description || `Unlocked Chapter (ID: ${chapterId})`,
        undefined, // No admin
        result.newBalance,
        'PURCHASE' // LOG TYPE
      ).catch(console.error);
    }

    return NextResponse.json({
      success: result.success,
      alreadyOwned: result.alreadyOwned,
      newBalance: result.newBalance
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}