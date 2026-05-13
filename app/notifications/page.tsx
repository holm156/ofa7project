import React from 'react';
import NotificationsClient from '../../components/NotificationsClient';
import { Layout } from '../../components/Layout';

export const metadata = {
    title: 'Notifications - Dusk Scans',
    description: 'View your latest updates and interactions.',
};

export default function NotificationsPage() {
    return <NotificationsClient />;
}
