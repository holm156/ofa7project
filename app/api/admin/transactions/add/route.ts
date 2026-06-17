import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { COIN_PACKAGES } from "../../../../../lib/packages";

const PKG_BONUS: Record<string, number> = {
    'pkg-1': 0,
    'pkg-2': 50,
    'pkg-3': 150,
    'pkg-4': 450,
    'pkg-5': 1200,
};

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { role: true, username: true }
    });

    if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'moderator')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { identifier, packageId } = await req.json();

        if (!identifier || !packageId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const pkg = COIN_PACKAGES.find((p: any) => p.id === packageId);
        if (!pkg) {
            return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
        }

        const targetUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: identifier.trim() },
                    { email: identifier.trim() }
                ]
            }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const coinsToAdd = pkg.coins + (PKG_BONUS[pkg.id] || 0);

        // Update user balance
        const updatedUser = await prisma.user.update({
            where: { id: targetUser.id },
            data: { coins: { increment: coinsToAdd } }
        });

        // Create transaction log
        const transaction = await prisma.coinTransaction.create({
            data: {
                userId: targetUser.id,
                amount: coinsToAdd,
                balanceAfter: updatedUser.coins,
                type: 'PURCHASE',
                description: `Admin Manual Add (${adminUser.username}): ${pkg.name}`
            },
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('Failed to add manual coins:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
