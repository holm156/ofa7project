import { NextResponse } from "next/server";
import { createPayPalOrder } from "../../../../lib/paypal";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { packageId } = await req.json();
        const order = await createPayPalOrder(packageId);
        return NextResponse.json(order);
    } catch (error: any) {
        console.error("PayPal Order creation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
