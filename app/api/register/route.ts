import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import bcrypt from 'bcryptjs';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ACCOUNTS_PER_WINDOW = 3; // Max 3 accounts per 10 mins

export async function POST(req: Request) {
  try {
    // Check Rate Limit based on IP
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const rateData = rateLimitMap.get(ip);

    if (rateData) {
      if (now - rateData.lastReset < RATE_LIMIT_WINDOW_MS) {
        if (rateData.count >= MAX_ACCOUNTS_PER_WINDOW) {
          return NextResponse.json({ message: 'Too many registration attempts. Please try again later.' }, { status: 429 });
        }
        rateData.count += 1;
      } else {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
      }
    } else {
      rateLimitMap.set(ip, { count: 1, lastReset: now });
    }

    // Periodically clean up old entries to prevent memory leaks
    if (rateLimitMap.size > 1000) {
      rateLimitMap.forEach((value, key) => {
        if (now - value.lastReset > RATE_LIMIT_WINDOW_MS) {
          rateLimitMap.delete(key);
        }
      });
    }

    const body = await req.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Validate username (3-20 chars, alphanumeric and underscores only)
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ message: 'Username must be between 3 and 20 characters' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(username)) {
      return NextResponse.json({ message: 'Username can only contain letters, numbers, and underscores' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
    }

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      return NextResponse.json({ message: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await (prisma as any).user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ message: 'Email already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await (prisma as any).user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        coins: 0, // Welcome bonus
        role: 'user'
      }
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: { id: user.id, email: user.email, username: user.username }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Registration Error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({
      message: 'Internal server error'
    }, { status: 500 });
  }
}
