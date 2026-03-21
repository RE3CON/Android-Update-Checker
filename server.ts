import express from "express";
import * as cheerio from 'cheerio';
import gplay from 'google-play-scraper';
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// --- API Routes ---

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`API Request: ${req.method} ${req.path}`);
    }
    next();
});

app.get("/api/test", (req, res) => {
    res.json({ message: "API is working" });
});

app.get("/api/auth/github/url", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${appUrl.replace(/\/$/, '')}/auth/callback`;
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,workflow,write:packages`;
    res.json({ url: authUrl });
});

app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    try {
        const response = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code
            })
        });
        const data = await response.json();
        
        // In a real app, store the token securely (e.g., in a session/cookie)
        // Here we just send a success message to the popup
        res.send(`
            <html>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${data.access_token}' }, '*');
                        window.close();
                    } else {
                        window.location.href = '/';
                    }
                </script>
                <p>Authentication successful. This window should close automatically.</p>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send("Authentication failed");
    }
});

// github-latest-beta logic
app.post("/api/github-latest-beta", async (req, res) => {
    console.log("Received request for /api/github-latest-beta");
    const { owner, repo } = req.body;
    
    const token = req.headers.authorization?.split(' ')[1] || process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
        'User-Agent': 'AppVersionTracker/1.0',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers });
        const releases = await response.json();
        
        if (!releases || releases.length === 0) return res.status(404).json({ error: 'No releases found' });
        
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
});

// check-update logic
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 1): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout per request
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok) return response;
            if (response.status === 403 || response.status === 404) throw new Error(`Fetch failed with status ${response.status}`);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    throw new Error('Failed after retries');
};

const updateStrategies: Record<string, (url: string, channel: string, appName?: string, token?: string) => Promise<{ version: string, downloadUrl: string, appName?: string, iconUrl?: string, metadata?: any }>> = {
    github: async (urlOrPackage: string, channel: string, appName?: string, token?: string) => {
        const cleanUrl = urlOrPackage.replace(/\/$/, '');
        if (!cleanUrl.includes('/')) {
            throw new Error('GitHub strategy requires a repository URL or owner/repo format');
        }
        
        const parts = cleanUrl.split('/');
        const owner = parts[parts.length - 2];
        const repo = parts[parts.length - 1];
        
        const githubToken = token || process.env.GITHUB_TOKEN;
        const headers: Record<string, string> = {
            'User-Agent': 'AppVersionTracker/1.0',
            ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {})
        };

        const [releasesRes, repoRes] = await Promise.all([
            fetchWithRetry(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers }),
            fetchWithRetry(`https://api.github.com/repos/${owner}/${repo}`, { headers })
        ]);
        
        const releases = await releasesRes.json();
        const repoData = await repoRes.json();

        if (!Array.isArray(releases) || releases.length === 0) {
            throw new Error('No releases found or invalid response from GitHub');
        }
        
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
            appName: repo.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            iconUrl: repoData.owner?.avatar_url,
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
        const appName = $('.app-title').first().text().trim() || urlOrPackage.split('/').pop()?.replace(/-/g, ' ');
        const iconUrl = $('.app-icon img').first().attr('src') || $('meta[property="og:image"]').attr('content');
        const directDownloadPath = $('a.accent_color.btn.btn-flat.btn-raised').attr('href');
        
        if (!directDownloadPath) throw new Error('Could not find direct APK download link');
        
        const downloadUrl = `https://www.apkmirror.com${directDownloadPath}`;
        
        return { version, downloadUrl, appName, iconUrl, metadata: { channel } };
    },
    "f-droid": async (urlOrPackage: string, channel: string) => {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const cleanUrl = urlOrPackage.replace(/\/$/, '');
        const packageName = cleanUrl.includes('/') ? cleanUrl.split('/').pop()! : cleanUrl;
        const response = await fetchWithRetry(`https://f-droid.org/en/packages/${packageName}/`, { headers });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const version = $('.package-version-header b').first().text().replace('Version ', '').trim();
        const appName = $('.package-header h3').first().text().trim() || packageName;
        const iconUrl = $('.package-header-image').attr('src');
        const apkLink = $('.package-version-download a').first().attr('href');
        const downloadUrl = apkLink ? apkLink : `https://f-droid.org/en/packages/${packageName}/`;
        
        return { version, downloadUrl, appName, iconUrl, metadata: { channel } };
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
        const appName = $('.title-m h1').first().text().trim() || packageName;
        const iconUrl = $('.icon img').first().attr('src');
        const downloadUrl = `https://apkpure.com/search?q=${packageName}`;
        
        return { version, downloadUrl, appName, iconUrl, metadata: { channel } };
    },
    "google-play": async (packageName: string, channel: string) => {
        try {
            const app = await gplay.app({ appId: packageName });
            return {
                version: app.version,
                downloadUrl: app.url,
                appName: app.title,
                iconUrl: app.icon,
                metadata: { channel }
            };
        } catch (error) {
            console.error(`Error checking update with google-play-scraper for ${packageName}:`, error);
            throw error;
        }
    },
    "aurora-store": async (packageName: string, channel: string) => {
        // Aurora Store uses Google Play as its backend
        try {
            const app = await gplay.app({ appId: packageName });
            return {
                version: app.version,
                downloadUrl: app.url,
                appName: app.title,
                iconUrl: app.icon,
                metadata: { channel }
            };
        } catch (error) {
            console.error(`Error checking update with google-play-scraper for ${packageName}:`, error);
            throw error;
        }
    },
    mobilism: async (packageName: string, channel: string) => {
        // Mobilism is a forum, scraping is hard without login/cookies
        // We return a search link as a fallback
        return { 
            version: 'Check Site', 
            downloadUrl: `https://forum.mobilism.org/search.php?keywords=${packageName}&sr=topics&sf=titleonly`,
            appName: packageName,
            metadata: { channel }
        };
    },
    "samsung-store": async (packageName: string, channel: string) => {
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        try {
            const url = `https://galaxy.store/${packageName}`;
            const response = await fetchWithRetry(url, { headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            let version = 'Check Store';
            
            // Look for version label and its next sibling
            const versionLabel = $('div:contains("Version")').first();
            if (versionLabel.length) {
                version = versionLabel.next().text().trim();
            } else {
                const appVersion = $('.app-version').first();
                if (appVersion.length) {
                    version = appVersion.text().trim();
                }
            }

            return {
                version: version || 'Check Store',
                downloadUrl: `https://galaxy.store/${packageName}`,
                appName: packageName,
                metadata: { channel }
            };
        } catch (error) {
            console.error(`Error checking Samsung Store for ${packageName}:`, error);
            return {
                version: 'Check Store',
                downloadUrl: `https://galaxy.store/${packageName}`,
                appName: packageName,
                metadata: { channel }
            };
        }
    },
    "neo-store": async (packageName: string, channel: string) => {
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        const response = await fetchWithRetry(`https://f-droid.org/en/packages/${packageName}/`, { headers });
        const html = await response.text();
        const $ = cheerio.load(html);
        const version = $('.package-version').first().text().trim();
        const appName = $('.package-header h3').first().text().trim() || packageName;
        const iconUrl = $('.package-header-image').attr('src');
        const downloadUrl = `https://f-droid.org/en/packages/${packageName}/`;
        return { version, downloadUrl, appName, iconUrl, metadata: { channel } };
    },
    "unofficial-store": async (packageName: string, channel: string) => {
        // Fallback to APKMirror for unofficial stores
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        const searchResponse = await fetchWithRetry(`https://www.apkmirror.com/?s=${packageName}&post_type=app_release`, { headers });
        const html = await searchResponse.text();
        const $ = cheerio.load(html);
        const firstResult = $('.appRow').first().find('.fontBlack').attr('href');
        if (!firstResult) return { version: 'Latest (Store)', downloadUrl: `https://www.apkmirror.com/?s=${packageName}`, metadata: { channel } };
        return { version: 'Latest (Store)', downloadUrl: `https://www.apkmirror.com${firstResult}`, metadata: { channel } };
    },
};

app.post("/api/check-update", async (req, res) => {
    console.log("Received request for /api/check-update");
    const { source, packageName, updateUrl, channel = 'stable', appName } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    const strategyPriority = ['github', 'f-droid', 'apkpure', 'google-play'];
    const isSamsung = (appName || '').toLowerCase().includes('samsung') || (packageName || '').toLowerCase().includes('samsung');
    
    let strategiesToTry = [source];
    
    // Add a few fallbacks if the primary source fails
    if (source !== 'google-play') strategiesToTry.push('google-play');
    if (source !== 'github') strategiesToTry.push('github');
    if (source !== 'f-droid') strategiesToTry.push('f-droid');
    
    if (isSamsung && source !== 'samsung-store') {
        strategiesToTry.push('samsung-store');
    }

    console.log(`Checking update for ${packageName} using strategies: ${strategiesToTry.join(', ')}`);

    const promises = strategiesToTry.map(async (s) => {
        const strategy = updateStrategies[s];
        if (strategy) {
            try {
                const result = await strategy(updateUrl || packageName, channel, appName, token);
                if (result.version && result.downloadUrl && result.version !== 'Unknown') {
                    // Skip auto-falling back to store if we only got a generic placeholder.
                    if ((s === 'google-play' || s === 'samsung-store' || s === 'aurora-store') && s !== source) {
                        if (result.version === 'Latest (Store)' || result.version === 'Check Store' || result.version === 'Varies with device' || result.version === 'VARY') {
                            return null;
                        }
                    }
                    return { source: s, ...result };
                }
            } catch (error) {
                console.error(`Error checking update with ${s}:`, error);
            }
        }
        return null;
    });

    const results = await Promise.all(promises);
    
    // Find the first successful result based on the order in strategiesToTry
    for (const s of strategiesToTry) {
        const result = results.find(r => r && r.source === s);
        if (result) {
            return res.json({ 
                latestVersion: result.version, 
                updateUrl: result.downloadUrl, 
                appName: result.appName || appName || packageName,
                iconUrl: result.iconUrl,
                source: result.source,
                channel: channel,
                ...(result.metadata || {})
            });
        }
    }
      
    return res.json({ latestVersion: 'Unknown', updateUrl: updateUrl, source: 'manual', channel: channel });
});

app.post("/api/resolve-package", async (req, res) => {
    const { packageName } = req.body;
    if (!packageName) return res.status(400).json({ error: 'Package name is required' });

    console.log(`Resolving package name: ${packageName}`);

    const headers = { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    try {
        // Try Google Play Store first
        const playUrl = `https://play.google.com/store/apps/details?id=${packageName}&hl=en`;
        const response = await fetch(playUrl, { headers });
        
        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Play Store often has the app name in a specific h1 tag or meta tag
            let appName = $('h1 span').first().text().trim() || $('h1').first().text().trim();
            
            // Fallback to meta tags if h1 fails
            if (!appName) {
                appName = $('meta[property="og:title"]').attr('content')?.split(' - ')[0]?.trim();
            }

            if (appName && appName !== 'Google Play') {
                const iconUrl = $('img[alt="Icon image"]').attr('src') || $('meta[property="og:image"]').attr('content');
                return res.json({ appName, iconUrl, source: 'google-play' });
            }
        }

        // Try F-Droid as fallback
        const fdroidResponse = await fetch(`https://f-droid.org/en/packages/${packageName}/`, { headers });
        if (fdroidResponse.ok) {
            const html = await fdroidResponse.text();
            const $ = cheerio.load(html);
            const appName = $('.package-header h3').first().text().trim() || $('h3').first().text().trim();
            const iconUrl = $('.package-header-image').attr('src');
            if (appName) {
                return res.json({ appName, iconUrl, source: 'f-droid' });
            }
        }

        return res.status(404).json({ error: 'Could not resolve package name' });
    } catch (error) {
        console.error(`Error resolving package ${packageName}:`, error);
        return res.status(500).json({ error: 'Internal server error during resolution' });
    }
});

// API 404 fallback
app.all("/api/*all", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// --- Vite Middleware ---
import { createServer as createViteServer } from "vite";

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
