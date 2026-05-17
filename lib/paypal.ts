
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const base = PAYPAL_MODE === 'live' ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export const COIN_PACKAGES = [
    { id: 'pkg-1', coins: 100, price: '1.00', name: 'Starter Pack', description: 'Great for a few chapters' },
    { id: 'pkg-2', coins: 550, price: '5.00', name: 'Novice Pack', description: 'More value for your money' },
    { id: 'pkg-3', coins: 1200, price: '10.00', name: 'Warrior Pack', description: 'Popular choice for readers' },
    { id: 'pkg-4', coins: 3000, price: '25.00', name: 'Master Pack', description: 'Best value for serious fans' },
    { id: 'pkg-5', coins: 7000, price: '50.00', name: 'Legendary Pack', description: 'Eternal reading glory' },
];

export async function generateAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error("Missing PayPal credentials");
    }
    const auth = Buffer.from(PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        body: "grant_type=client_credentials",
        headers: {
            Authorization: `Basic ${auth}`,
        },
    });
    const data = await response.json();
    return data.access_token;
}

export async function createPayPalOrder(packageId: string) {
    const pkg = COIN_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new Error("Invalid package");

    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            intent: "CAPTURE",
            application_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                brand_name: "Omen Scans"
            },
            purchase_units: [
                {
                    amount: {
                        currency_code: "USD",
                        value: pkg.price,
                    },
                    description: `Digital-Ref-${pkg.id}`,
                    custom_id: packageId,
                },
            ],
        }),
    });
    return await response.json();
}

export async function capturePayPalOrder(orderId: string) {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders/${orderId}/capture`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
    });
    return await response.json();
}
