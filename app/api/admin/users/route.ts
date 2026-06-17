import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { notifyCoinTransaction } from '../../../../lib/discord';

// API to search users (Admins Only)
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    // STRICT ADMIN CHECK - Moderators NOT allowed
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'FORBIDDEN: Admins Only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json([]);
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query } },
                    { email: { contains: query } },
                    { name: { contains: query } }
                ]
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                coins: true,
                role: true,
                createdAt: true
            },
            take: 10
        });

        // Ensure display name is always present
        const formattedUsers = users.map(u => ({
            ...u,
            username: u.username || u.name || 'Unknown User'
        }));

        return NextResponse.json(formattedUsers);
    } catch (e) {
        console.error("Admin search user error:", e);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}

// API to manage coins (Admins Only)
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    // STRICT ADMIN CHECK - Moderators NOT allowed
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'FORBIDDEN: Admins Only' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { userId, amount, action = 'add' } = body;

        // Action must be add, deduct, or set
        if (!userId || typeof amount !== 'number' || !['add', 'deduct', 'set'].includes(action)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { coins: true }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        let newBalance = targetUser.coins;
        let successMessage = '';

        if (action === 'set') {
            newBalance = Math.max(0, amount);
            successMessage = `Set coins to ${newBalance}`;
        } else if (action === 'deduct') {
            newBalance = Math.max(0, targetUser.coins - amount);
            successMessage = `Deducted ${amount} coins`;
        } else {
            // default to add
            newBalance = Math.max(0, targetUser.coins + amount);
            successMessage = `Added ${amount} coins`;
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                coins: newBalance
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                coins: true
            }
        });

        // Log Transaction
        await (prisma as any).coinTransaction.create({
            data: {
                userId: updatedUser.id,
                adminId: (session.user as any).id, // Log the admin who performed the action
                amount: action === 'set' ? (newBalance - targetUser.coins) : (action === 'deduct' ? -amount : amount),
                balanceAfter: newBalance,
                type: `ADMIN_${action.toUpperCase()}`,
                description: successMessage
            }
        });

        // Notify Discord
        notifyCoinTransaction(
            updatedUser,
            action === 'set' ? (newBalance - targetUser.coins) : (action === 'deduct' ? -amount : amount),
            `ADMIN_${action.toUpperCase()}`,
            successMessage,
            (session.user as any).name || (session.user as any).username || 'Admin', // Pass admin name
            updatedUser.coins, // Pass new balance
            'TRANSACTION' // LOG TYPE
        ).catch(console.error);

        const displayName = updatedUser.username || updatedUser.name || 'User';

        return NextResponse.json({
            success: true,
            message: `${successMessage} for ${displayName}`,
            newBalance: updatedUser.coins
        });
    } catch (e) {
        console.error("Admin manage coins error:", e);
        return NextResponse.json({ error: 'Failed to manage coins' }, { status: 500 });
    }
}

// API to update user role (Admins Only)
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);

    // STRICT ADMIN CHECK
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'FORBIDDEN: Admins Only' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { userId, role } = body;

        if (!userId || !role || !['user', 'moderator', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                username: true,
                name: true,
                role: true
            }
        });

        const displayName = updatedUser.username || updatedUser.name || 'User';

        return NextResponse.json({
            success: true,
            message: `Updated role for ${displayName} to ${role}`,
            newRole: updatedUser.role
        });
    } catch (e) {
        console.error("Admin update role error:", e);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }
}

