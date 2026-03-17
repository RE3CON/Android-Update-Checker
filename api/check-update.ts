import * as cheerio from 'cheerio';

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status === 403 || response.status === 404) throw new Error(`Fetch failed with status ${response.status}`);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('Failed after retries');
};

const updateStrategies: Record<string, (url: string, channel: string) => Promise<{ version: string, downloadUrl: string, metadata?: any }>> = {
    github: async (urlOrPackage: string, channel: string) => {
        if (!urlOrPackage.includes('/')) {
            throw new Error('GitHub strategy requires a repository URL or owner/repo format');
        }
        
        const parts = urlOrPackage.split('/');
        const owner = parts[parts.length - 2];
        const repo = parts[parts.length - 1];
        
        const token = process.env.GITHUB_TOKEN;
        const headers: Record<string, string> = {
            'User-Agent': 'AppVersionTracker/1.0',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const response = await fetchWithRetry(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers });
        
        const releases = await response.json();
        if (!releases || releases.length === 0) throw new Error('No releases found');
        
        let filteredReleases = releases;
        if (channel === 'stable') {
            filteredReleases = releases.filter((r: any) => !r.prerelease);
        }
        
        filteredReleases.sort((a: any, b: any) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
        
        const latestRelease = filteredReleases[0];
        if (!latestRelease) throw new Error('No releases match the requested channel');
        
        const artifact = latestRelease.assets.find((a: any) => a.name.endsWith('.apk'));
        
        return { 
            version: latestRelease.tag_name, 
            downloadUrl: artifact?.browser_download_url || latestRelease.html_url,
            metadata: { releaseDate: latestRelease.published_at, isPrerelease: latestRelease.prerelease }
        };
    },
    apkmirror: async (urlOrPackage: string, channel: string) => {
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.apkmirror.com/'
        };
        
        let downloadPageUrl = urlOrPackage;
        if (!urlOrPackage.startsWith('http')) {
            const searchResponse = await fetchWithRetry(`https://www.apkmirror.com/?s=${urlOrPackage}&post_type=app_release`, { headers });
            const html = await searchResponse.text();
            const $ = cheerio.load(html);
            const firstResult = $('.appRow').first().find('.fontBlack').attr('href');
            if (!firstResult) throw new Error('No results found on APKMirror');
            downloadPageUrl = `https://www.apkmirror.com${firstResult}`;
        }
        
        const response = await fetchWithRetry(downloadPageUrl, { headers });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const version = $('.app-version-name').first().text().trim();
        const directDownloadPath = $('a.accent_color.btn.btn-flat.btn-raised').attr('href');
        
        if (!directDownloadPath) throw new Error('Could not find direct APK download link');
        
        const downloadUrl = `https://www.apkmirror.com${directDownloadPath}`;
        
        return { version, downloadUrl, metadata: { channel } };
    },
    "f-droid": async (urlOrPackage: string, channel: string) => {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const packageName = urlOrPackage.includes('/') ? urlOrPackage.split('/').pop()! : urlOrPackage;
        const response = await fetchWithRetry(`https://search.f-droid.org/?q=${packageName}`, { headers });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const version = $('.package-version').first().text().trim();
        const downloadUrl = $('.package-header-image').attr('href') || `https://f-droid.org/en/packages/${packageName}/`;
        
        return { version, downloadUrl, metadata: { channel } };
    },
    apkpure: async (urlOrPackage: string, channel: string) => {
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://apkpure.com/'
        };
        const packageName = urlOrPackage.includes('/') ? urlOrPackage.split('/').pop()! : urlOrPackage;
        const response = await fetchWithRetry(`https://apkpure.com/search?q=${packageName}`, { headers });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const version = $('.ver-item-n').first().text().trim();
        const downloadUrl = `https://apkpure.com/search?q=${packageName}`;
        
        return { version, downloadUrl, metadata: { channel } };
    },
    "google-play": async (packageName: string, channel: string) => {
        return { version: 'Latest (Store)', downloadUrl: `https://play.google.com/store/apps/details?id=${packageName}`, metadata: { channel } };
    },
    "samsung-store": async (packageName: string, channel: string) => {
        return { version: 'Latest (Store)', downloadUrl: `https://apps.samsung.com/appquery/appDetail.as?appId=${packageName}`, metadata: { channel } };
    },
};

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', 'https://re3con.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { source, packageName, updateUrl, channel = 'stable', appName } = req.body;
    
    const strategyPriority = ['github', 'apkmirror', 'f-droid', 'apkpure', 'samsung-store', 'google-play'];
    const isSamsung = (appName || '').toLowerCase().includes('samsung') || (packageName || '').toLowerCase().includes('samsung');
    
    let strategiesToTry = [source, ...strategyPriority.filter(s => s !== source)];
    
    if (!isSamsung) {
        strategiesToTry = strategiesToTry.filter(s => s !== 'samsung-store');
    }

    for (const s of strategiesToTry) {
        const strategy = updateStrategies[s];
        if (strategy) {
            try {
                const { version, downloadUrl, metadata } = await strategy(updateUrl || packageName, channel);
                if (version && downloadUrl && version !== 'Unknown') {
                    return res.json({ 
                        latestVersion: version, 
                        updateUrl: downloadUrl, 
                        source: s,
                        channel: channel,
                        ...metadata
                    });
                }
            } catch (error) {
                console.error(`Error checking update with ${s}:`, error);
            }
        }
    }
      
    return res.json({ latestVersion: 'Unknown', updateUrl: updateUrl, source: 'manual', channel: channel });
}
