import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or moderator
    const user = await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { role: true }
    });

    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const transactions = await prisma.coinTransaction.findMany({
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100 // Limit to most recent 100
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
