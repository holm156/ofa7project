import React from 'react';

export default function PrivacyPage() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-4xl font-bold mb-8 text-white">Privacy Policy</h1>
            <div className="glass-panel p-8 rounded-2xl border border-white/10 text-zinc-300 space-y-6">
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                    <p>We collect information that you provide directly to us, such as when you create an account, purchase coins, or communicate with us. This may include your email address, username, and transaction history.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">2. Cookies and Tracking</h2>
                    <p>We use cookies to improve your experience, remember your preferences, and analyze our traffic. We also use third-party services like Google Analytics and ad networks which may use cookies to serve ads based on your visits to this and other websites.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Information</h2>
                    <p>Your information is used to maintain your account, process coin transactions, provide customer support, and improve our services. We do not sell your personal information to third parties.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
                    <p>We work with third-party advertising partners to show ads. These partners may collect data about your interactions with ads. Please review their respective privacy policies for more information.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">5. Data Security</h2>
                    <p>We take reasonable measures to protect your personal information from unauthorized access or disclosure. However, no method of transmission over the internet is 100% secure.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
                    <p>Depending on your location, you may have rights to access, correct, or delete your personal information. You can manage your account settings or contact us for assistance.</p>
                </section>

                <p className="text-sm text-zinc-500 mt-8">Last Updated: March 2026</p>
            </div>
        </div>
    );
}
