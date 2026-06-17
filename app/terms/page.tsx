import React from 'react';

export default function TermsPage() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-4xl font-bold mb-8 text-white">Terms of Service</h1>
            <div className="glass-panel p-8 rounded-2xl border border-white/10 text-zinc-300 space-y-6">
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                    <p>By accessing or using DuskScans, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">2. User Accounts</h2>
                    <p>You are responsible for maintaining the confidentiality of your account credentials. Any activity under your account is your responsibility. We reserve the right to terminate accounts that violate our terms or engage in abusive behavior.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">3. Virtual Currency (Coins)</h2>
                    <p>Coins purchased on DuskScans are a virtual currency used to unlock premium content. Coins are non-refundable and have no cash value. We reserve the right to manage, regulate, and modify the coin system at our discretion.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">4. Intellectual Property</h2>
                    <p>The content on this site is provided for entertainment purposes. We respect the intellectual property rights of others and expect our users to do the same. Please refer to our DMCA policy for copyright concerns.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">5. Prohibited Conduct</h2>
                    <p>Users are prohibited from using the site for any illegal purposes, attempting to disrupt the service, or scraping content without authorization.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">6. Disclaimer of Liability</h2>
                    <p>DuskScans is provided "as is" without warranties of any kind. We are not liable for any damages resulting from your use of the site.</p>
                </section>

                <p className="text-sm text-zinc-500 mt-8">Last Updated: March 2026</p>
            </div>
        </div>
    );
}
