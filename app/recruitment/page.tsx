"use client";

import React from 'react';
import { Card, Button } from '../../components/UIComponents';
import { Briefcase, PenTool, Globe, Mail } from 'lucide-react';

const Recruitment: React.FC = () => {
    const roles = [
        {
            title: 'Translator (KR/JP/CN)',
            Icon: Globe,
            iconColor: 'text-blue-400',
            desc: 'Translate manga/manhwa/manhua from source language to English. Must be fluent and experienced.',
            status: 'Closed'
        },
        {
            title: 'Typesetter',
            Icon: PenTool,
            iconColor: 'text-red-400',
            desc: 'Place text into bubbles using Photoshop. Experience with fonts and sound effects required.',
            status: 'Closed'
        },
        {
            title: 'Cleaner / Redrawer',
            Icon: Briefcase,
            iconColor: 'text-green-400',
            desc: 'Clean raw pages and redraw sound effects/backgrounds. High proficiency in Photoshop required.',
            status: 'Closed'
        }
    ];

    return (
        <div className="space-y-10 pb-12 px-4 md:px-24 lg:px-32">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Join the Team</h1>
                <p className="text-zinc-400 max-w-2xl mx-auto">
                    We are always looking for talented individuals to join our scanlation team.
                    If you have a passion for comics and want to contribute, apply below!
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {roles.map((role, idx) => (
                    <Card key={idx} className="p-6 flex flex-col items-center text-center hover:border-primary/50 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-surfaceHighlight flex items-center justify-center mb-4">
                            <role.Icon className={`w-6 h-6 ${role.iconColor}`} />
                        </div>
                        <h3 className="text-lg font-bold mb-2">{role.title}</h3>
                        <p className="text-sm text-zinc-500 mb-6 flex-1">{role.desc}</p>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${role.status === 'Urgent' ? 'bg-red-500/20 text-red-400' :
                                role.status === 'Open' ? 'bg-green-500/20 text-green-400' :
                                    'bg-zinc-700 text-zinc-400'
                            }`}>
                            {role.status}
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="p-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Ready to apply?</h2>
                        <p className="text-zinc-400">Join our Discord server or send us an email with your portfolio.</p>
                    </div>
                    <div className="flex gap-4">
                        <a href={process.env.NEXT_PUBLIC_DISCORD_URL} target="_blank" rel="noopener noreferrer">
                            <Button className="gap-2">
                                <Briefcase className="w-4 h-4" /> Apply via Discord
                            </Button>
                        </a>
                        <Button variant="outline" className="gap-2">
                            <Mail className="w-4 h-4" /> Email Us
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Recruitment;
