import React from 'react';

export default function DMCAPage() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-4xl font-bold mb-8 text-white">DMCA Policy</h1>
            <div className="glass-panel p-8 rounded-2xl border border-white/10 text-zinc-300 space-y-6">
                <p>
                    Dusk Scans aims to familiarize a western demographic with foreign forms of literature. To achieve this goal, the books&apos; fragments found on our website have been crowdsourced from a wide range of users, which in turn, makes it impossible for us to maintain control over all material found on our website.
                </p>

                <p>
                    We respect the intellectual property rights of others. In accordance with the Digital Millennium Copyright Act (DMCA), we will respond promptly to claims of copyright infringement that are reported to our designated copyright agent. If an author considers fragments found on this website a violation of their intellectual property, they are welcomed to contact us.
                </p>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">1. DMCA Notice</h2>
                    <p>If you are a copyright owner or an agent thereof and believe that any content on our site infringes upon your copyrights, you may submit a notification pursuant to the DMCA by providing our Copyright Agent with the following information in writing:</p>
                    <ul className="list-disc pl-6 space-y-2 mt-2">
                        <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
                        <li>Identification of the copyrighted work claimed to have been infringed.</li>
                        <li>Identification of the material that is claimed to be infringing and information reasonably sufficient to permit us to locate the material (e.g., a direct URL).</li>
                        <li>Information reasonably sufficient to permit us to contact you, such as an address, telephone number, and email address.</li>
                        <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
                        <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">2. Contact Information</h2>
                    <p>Please send your DMCA notices to our designated agent at:</p>
                    <p className="mt-2 font-medium text-primary">Email: dmca@duskscans.com</p>
                    <p className="text-sm italic mt-1">(Please note that this email is for copyright concerns only. General inquiries will not receive a response.)</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">3. Counter-Notification</h2>
                    <p>If you believe that your content was removed by mistake or misidentification, you may submit a counter-notification to our copyright agent with the required information under the DMCA.</p>
                </section>

                <p className="text-sm text-zinc-500 mt-8">Last Updated: March 2026</p>
            </div>
        </div>
    );
}
