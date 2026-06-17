"use client";

import React, { useState } from 'react';
import { Coins, Check, Zap, Rocket, Crown, Star, ShieldCheck, X, Sparkles, Shield } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { COIN_PACKAGES } from '../../lib/packages';

const PKG_BONUS: Record<string, number> = {
    'pkg-1': 0,
    'pkg-2': 50,
    'pkg-3': 150,
    'pkg-4': 450,
    'pkg-5': 1200,
};

const PKG_POPULAR: Record<string, boolean> = {
    'pkg-3': true,
};

export default function BuyCoinsPage() {
    // EARLY RETURN TO DISABLE THE PAGE COMPLETELY
    return (
        <div className="min-h-screen flex flex-col items-center justify-center pt-20 px-4">
            <Sparkles className="w-16 h-16 text-primary mb-6 animate-pulse" />
            <h1 className="text-4xl font-black text-white mb-4 text-center">100% Free Forever!</h1>
            <p className="text-zinc-400 text-center max-w-md text-lg">
                Dusk Scans is fully free. You don't need to buy any coins to enjoy our premium manhwa. Happy reading!
            </p>
        </div>
    );

    const { currentUser } = useStore();
    const { showToast } = useToast();
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const [binanceUsername, setBinanceUsername] = useState('');
    const [binanceTxId, setBinanceTxId] = useState('');
    const [binanceSending, setBinanceSending] = useState(false);

    const handleBinanceSubmit = async () => {
        if (!binanceUsername.trim()) {
            showToast('Please enter your Username or Email.', 'error');
            return;
        }
        if (!binanceTxId.trim()) {
            showToast('Please enter your Transaction ID (TxID).', 'error');
            return;
        }
        setBinanceSending(true);
        try {
            await fetch('/api/binance/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: binanceUsername.trim(),
                    txId: binanceTxId.trim(),
                    amount: selectedPackage.price,
                    package: selectedPackage.name,
                }),
            });
            showToast('Your payment has been submitted! We will review and add your coins shortly.', 'success');
            setBinanceUsername('');
            setBinanceTxId('');
            setSelectedPackage(null);
        } catch {
            showToast('Failed to submit. Please try again.', 'error');
        } finally {
            setBinanceSending(false);
        }
    };


    if (!currentUser) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-red-600/20 border border-primary/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(217,70,239,0.2)]">
                    <Coins className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-black mb-3 text-white">Coin Store</h1>
                <p className="text-zinc-400 mb-8 max-w-md">Please login to purchase coins and unlock premium chapters.</p>
                <a href="/login" className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:-translate-y-0.5 transition-all">
                    Login to Continue
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-white mb-2">Recharge Coins</h1>
                <p className="text-zinc-500">Support the team and unlock chapters instantly.</p>
                <div className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/10">
                    <Coins className="w-4 h-4 text-rose-400" />
                    <span className="text-zinc-400 text-sm">Balance:</span>
                    <span className="text-rose-400 font-black">{currentUser?.coins || 0} coins</span>
                </div>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {COIN_PACKAGES.map((pkg, idx) => {
                    const isPopular = PKG_POPULAR[pkg.id];
                    const bonus = PKG_BONUS[pkg.id];
                    const isSelected = selectedPackage?.id === pkg.id;
                    const isLast = idx === COIN_PACKAGES.length - 1 && COIN_PACKAGES.length % 2 !== 0;

                    return (
                        <div key={pkg.id} className={isLast ? "sm:col-span-2" : ""}>
                            <PackageCard
                                pkg={pkg}
                                bonus={bonus}
                                isPopular={isPopular}
                                isSelected={isSelected}
                                onClick={() => setSelectedPackage(pkg)}
                                wide={isLast}
                            />
                        </div>
                    );
                })}
            </div>

            {/* ── ORDER SUMMARY (Inline) ── */}
            {selectedPackage && (
                <div className="mt-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="glass-panel rounded-3xl border-primary/20 bg-[#0d0d0d] overflow-hidden shadow-[0_0_40px_rgba(217,70,239,0.1)]">
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Order Summary</h2>
                                <button onClick={() => setSelectedPackage(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4 mb-10">
                                <div className="flex justify-between items-center text-zinc-500">
                                    <span>{selectedPackage.coins.toLocaleString()} Coins</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-300 font-medium">{selectedPackage.coins.toLocaleString()}</span>
                                        <Coins className="w-4 h-4 text-orange-500 fill-orange-500/20" />
                                    </div>
                                </div>

                                {PKG_BONUS[selectedPackage.id] > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-orange-500/80 font-medium">Bonus coins</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-orange-500 font-bold">+{PKG_BONUS[selectedPackage.id].toLocaleString()}</span>
                                            <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center">
                                                <Coins className="w-3.5 h-3.5 text-orange-500" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="h-px bg-white/5 my-2" />

                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-white font-bold text-lg">Total coins</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-black text-2xl">{(selectedPackage.coins + PKG_BONUS[selectedPackage.id]).toLocaleString()}</span>
                                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                                            <Coins className="w-4 h-4 text-orange-500" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-white font-bold text-lg">Price</span>
                                    <span className="text-[#f1b434] font-black text-3xl">${selectedPackage.displayPrice}</span>
                                </div>
                            </div>

                            {/* Payment Options */}
                            <div className="space-y-4">
                                <div className="text-zinc-400 text-sm mb-2 font-medium">Select Payment Method:</div>

                                {/* Ko-fi Payment */}
                                <div className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-[#13C3FF]/20 flex items-center justify-center">
                                            <span className="text-[#13C3FF] font-bold text-lg">K</span>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">Ko-fi</h3>
                                            <p className="text-zinc-400 text-xs">Pay securely with card or PayPal via Ko-fi</p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-rose-300 bg-rose-500/10 p-3 rounded-lg mb-3 border border-rose-500/20">
                                        <strong>Important:</strong> Please write your <strong>Account Email or Username</strong> in the Ko-fi "Message" box so we can add your coins automatically!
                                    </div>
                                    <a href={`https://ko-fi.com/duskorg?amount=${selectedPackage.price}`} target="_blank" rel="noopener noreferrer" className="block w-full py-2.5 rounded-lg bg-[#13C3FF] text-white font-bold text-center hover:bg-[#13C3FF]/90 transition-colors">
                                        Donate ${selectedPackage.displayPrice} on Ko-fi
                                    </a>
                                </div>

                                {/* Binance Payment */}
                                <div className="p-4 rounded-xl border border-[#FCD535]/20 bg-[#FCD535]/5 transition-colors">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-[#FCD535]/20 flex items-center justify-center">
                                            <span className="text-[#FCD535] font-bold text-lg">B</span>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">Binance Crypto</h3>
                                            <p className="text-zinc-400 text-xs">Send USDT directly to our wallet</p>
                                        </div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-lg mb-4 space-y-3 text-xs font-mono">
                                        <div>
                                            <span className="inline-block bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded text-[10px] font-bold mb-1">TRC20 — Tron Network</span>
                                            <p className="text-zinc-300 break-all select-all">TYsM8gjFkuXfVetcaknN4bZmGETRaamXfW</p>
                                        </div>
                                        <div className="border-t border-white/5 pt-3">
                                            <span className="inline-block bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px] font-bold mb-1">BEP20 — BSC Network</span>
                                            <p className="text-zinc-300 break-all select-all">0xfb2f2f61e54fa2ecec7a544db6576a7d310d2d9b</p>
                                        </div>
                                        <div className="border-t border-white/5 pt-3 flex justify-between items-center">
                                            <span className="text-zinc-500">Amount to send:</span>
                                            <span className="text-[#FCD535] font-bold text-sm">{selectedPackage.price} USDT</span>
                                        </div>
                                    </div>

                                    {/* Form */}
                                    <div className="space-y-3 mb-4">
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1 font-medium">Your Username or Email <span className="text-rose-400">*</span></label>
                                            <input
                                                type="text"
                                                value={binanceUsername}
                                                onChange={e => setBinanceUsername(e.target.value)}
                                                placeholder="e.g. john123 or john@email.com"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FCD535]/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1 font-medium">Transaction ID (TxID) <span className="text-rose-400">*</span></label>
                                            <input
                                                type="text"
                                                value={binanceTxId}
                                                onChange={e => setBinanceTxId(e.target.value)}
                                                placeholder="Paste your TxID here"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FCD535]/50 font-mono"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleBinanceSubmit}
                                        disabled={binanceSending}
                                        className="w-full py-2.5 rounded-lg bg-[#FCD535] text-black font-bold text-center hover:bg-[#FCD535]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {binanceSending ? 'Submitting...' : `I have sent $${selectedPackage.price} USDT`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* "What You Get" Section */}
            <div className="mt-20">
                <h2 className="text-2xl font-black text-white text-center mb-8">
                    What You <span className="text-primary">Get</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-panel p-6 rounded-2xl border-white/5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
                            <Star className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Premium Chapters</h3>
                        <p className="text-zinc-500 text-sm">Unlock early access to the latest chapters</p>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl border-white/5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
                            <Zap className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Instant Delivery</h3>
                        <p className="text-zinc-500 text-sm">Coins are added to your balance immediately</p>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl border-white/5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Secure Payment</h3>
                        <p className="text-zinc-500 text-sm">Secure payments via Ko-fi and Binance</p>
                    </div>
                </div>
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-zinc-600 text-xs">
                <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> SSL Secured</div>
                <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> Instant Delivery</div>
                <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> Verified Methods</div>
            </div>
        </div>
    );
}

function PackageCard({ pkg, bonus, isPopular, isSelected, onClick, wide }: {
    pkg: any; bonus: number; isPopular?: boolean; isSelected: boolean; onClick: () => void; wide?: boolean;
}) {
    return (
        <div className="relative h-full" onClick={onClick}>
            {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-1 rounded-full bg-primary text-white text-[10px] font-black uppercase shadow-lg tracking-widest">
                    Most Popular
                </div>
            )}

            <div className={`cursor-pointer rounded-2xl border h-full transition-all duration-200 p-6 flex items-center justify-between
                ${isSelected
                    ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(217,70,239,0.15)]'
                    : isPopular
                        ? 'border-primary/40 bg-white/[0.03] hover:border-primary/60 hover:bg-white/[0.05]'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'}`}>

                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`font-black text-white ${wide ? 'text-4xl' : 'text-3xl'}`}>
                            {pkg.coins.toLocaleString()}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Coins className="w-4 h-4 text-primary" />
                        </div>
                    </div>
                    <span className="text-zinc-400 font-bold text-lg">${pkg.displayPrice}</span>
                </div>

                {bonus > 0 && (
                    <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end mb-0.5">
                            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Coins className="w-3 h-3 text-primary" />
                            </div>
                            <span className="text-primary font-black">+{bonus.toLocaleString()}</span>
                        </div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">Coins Bonus</span>
                    </div>
                )}
            </div>
        </div>
    );
}
