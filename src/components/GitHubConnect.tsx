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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                connected ? 'bg-green-600 text-white' : 'bg-stone-900 text-white hover:bg-stone-800'
            }`}
        >
            <Github size={20} />
            {connected ? 'GitHub Connected' : 'Connect GitHub'}
        </button>
    );
};
