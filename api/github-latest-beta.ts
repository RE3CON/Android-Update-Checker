import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { owner, repo } = req.body;
    
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
        'User-Agent': 'AppVersionTracker/1.0',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers });
        const releases = await response.json();
        
        if (!releases || releases.length === 0) return res.status(404).json({ error: 'No releases found' });
        
        // Find the latest release that is a prerelease (beta)
        const betaRelease = releases.find((r: any) => r.prerelease);
        if (!betaRelease) return res.status(404).json({ error: 'No beta release found' });
        
        const artifact = betaRelease.assets.find((a: any) => a.name.endsWith('.apk'));
        
        if (!artifact) return res.status(404).json({ error: 'No APK artifact found in beta release' });

        return res.json({
            id: betaRelease.id,
            name: betaRelease.name,
            archive_download_url: artifact.browser_download_url
        });
    } catch (error) {
        console.error('Error fetching beta release:', error);
        return res.status(500).json({ error: 'Failed to fetch beta release' });
    }
}
