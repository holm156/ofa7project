"use client";

import React from 'react';
import { StoreProvider } from '../context/StoreContext';
import { ToastProvider } from '../context/ToastContext';
import { SessionProvider } from 'next-auth/react';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <SessionProvider>
            <ToastProvider>
                <StoreProvider>
                    <div className="min-h-screen flex flex-col">
                        {children}
                    </div>
                </StoreProvider>
            </ToastProvider>
        </SessionProvider>
    );
};
