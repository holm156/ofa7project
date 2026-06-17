"use client";

import React from 'react';
import { Manga } from '../types';
import { MangaCard } from './MangaComponents';
import { BookOpen } from 'lucide-react';

interface RelatedSeriesProps {
    mangas: Manga[];
}

export default function RelatedSeries({ mangas }: RelatedSeriesProps) {
    if (!mangas || mangas.length === 0) return null;

    return (
        <section className="mt-12">
            <div className="flex items-center gap-3 mb-6">
                <BookOpen className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Related Series</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {mangas.map((manga) => (
                    <MangaCard key={manga.id} manga={manga} />
                ))}
            </div>
        </section>
    );
}
