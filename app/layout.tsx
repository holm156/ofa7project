import React from 'react';
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/Providers';
import { Navbar, Footer, Sidebar, MobileBottomNav, Layout } from '../components/Layout';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://duskscans.com'),
  title: 'Dusk Scans - Read Manhwa Online',
  description: 'Dusk Scans is a manhwa reading platform built for speed, featuring high-quality translations and daily updates.',
  keywords: ['manhwa', 'manga', 'read online', 'duskscans', 'manhwa platform', 'free manhwa', 'comics'],
  icons: {
    icon: '/logo1.png',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Dusk Scans - Your Favorite Manhwa Online',
    description: 'Read the latest manhwa and manga chapters online for free on Dusk Scans.',
    url: 'https://duskscans.com',
    siteName: 'Dusk Scans',
    images: [{ url: '/logo1.png', width: 800, height: 600 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dusk Scans - Read Manhwa Online',
    description: 'The best experience for reading manhwa and manga online.',
    images: ['/logo1.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${outfit.variable}`} suppressHydrationWarning>
      <head />
      <body className="bg-background text-text font-sans overflow-x-hidden min-h-screen">
        <Providers>
          <Layout>
            {children}
          </Layout>
        </Providers>
      </body>
    </html>
  );
}
