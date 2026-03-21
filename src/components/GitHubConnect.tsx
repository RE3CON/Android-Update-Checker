import React, { useEffect, useState } from 'react';
import { Github } from 'lucide-react';

export const GitHubConnect: React.FC = () => {
    const [connected, setConnected] = useState(false);

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

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
                console.log('GitHub connected successfully!');
                setConnected(true);
                // Optionally save token to localStorage or state
                localStorage.setItem('github_token', event.data.token);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <button
            onClick={handleConnect}
            className={`flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2 rounded-full sm:rounded-lg font-medium transition-all duration-300 active:scale-90 ${
                connected 
                    ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'bg-samsung-gray-100 dark:bg-white/5 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/10'
            }`}
            title={connected ? 'GitHub Connected' : 'Connect GitHub'}
        >
            <Github size={20} />
            <span className="hidden sm:inline">{connected ? 'GitHub Connected' : 'Connect GitHub'}</span>
        </button>
    );
};
