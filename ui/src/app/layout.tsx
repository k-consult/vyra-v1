import type { Metadata } from 'next';
import './globals.css';
import { NavShell } from '@/components/nav-shell';

export const metadata: Metadata = {
    title: 'Vyra — Compliance. Handled.',
    description: 'Agentic Risk & Compliance Infrastructure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <NavShell>{children}</NavShell>
            </body>
        </html>
    );
}
