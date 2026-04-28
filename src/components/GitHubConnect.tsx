import React, { useEffect, useState } from 'react';
import { Github, LogOut } from 'lucide-react';

export const GitHubConnect: React.FC = () => {
    // Bug fix #15: initialize from localStorage so state persists across page refreshes
    const [connected, setConnected] = useState<boolean>(() => {
        const token = localStorage.getItem('github_token');
        return !!token && token !== 'undefined';
    });

    const handleConnect = async () => {
        try {
            const response = await fetch('/api/auth/github/url');
            if (!response.ok) throw new Error('Failed to get auth URL');
            const { url } = await response.json();

            const authWindow = window.open(url, 'github_oauth', 'width=600,height=700');
            
            if (!authWindow) {
                alert('Please allow popups to connect your GitHub account.');
                return;
            }
        } catch (error) {
            console.error('OAuth error:', error);
        }
    };

    const handleDisconnect = (e: React.MouseEvent) => {
        e.stopPropagation();
        localStorage.removeItem('github_token');
        setConnected(false);
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Bug fix #2: Only accept messages from the same origin to prevent token interception
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.token) {
                console.log('GitHub connected successfully!');
                setConnected(true);
                localStorage.setItem('github_token', event.data.token);
            } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
                console.error('GitHub OAuth failed:', event.data.error);
                alert(`GitHub authentication failed: ${event.data.error}`);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (connected) {
        return (
            <div className="flex items-center gap-1">
                <div
                    className="flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2 rounded-full sm:rounded-lg font-medium bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    title="GitHub Connected"
                >
                    <Github size={20} />
                    <span className="hidden sm:inline">Connected</span>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all active:scale-90"
                    title="Disconnect GitHub"
                >
                    <LogOut size={16} />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnect}
            className="flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2 rounded-full sm:rounded-lg font-medium bg-samsung-gray-100 dark:bg-white/5 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/10 transition-all duration-300 active:scale-90"
            title="Connect GitHub"
        >
            <Github size={20} />
            <span className="hidden sm:inline">Connect GitHub</span>
        </button>
    );
};
