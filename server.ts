import express from "express";
import * as cheerio from 'cheerio';
import gplay from 'google-play-scraper';
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// Rate limiting middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many API requests from this IP, please try again later.' }
});

// Apply rate limiter to all API routes
app.use('/api/', apiLimiter);

// --- Helpers ---
function sanitizeInput(input: string | undefined | null): string {
    if (!input) return '';
    // Strip everything except alphanumeric, dots, dashes, underscores, plus, and tildes
    return String(input).replace(/[^a-zA-Z0-9.\-_~+]/g, '');
}

function isValidPackageName(packageName: string): boolean {
    // Android package identifiers: dot-separated identifiers, each starting with a letter.
    // Example: com.example.app
    return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName);
}

function isValidDomain(urlStr: string, expectedDomain: string): boolean {
    try {
        const parsed = new URL(urlStr);
        return parsed.hostname === expectedDomain || parsed.hostname.endsWith('.' + expectedDomain);
    } catch {
        return false;
    }
}

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
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const targetOrigin = appUrl.replace(/\/$/, '');

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

        // Bug fix #3: Check for OAuth error before proceeding
        if (data.error || !data.access_token) {
            const errMsg = data.error_description || data.error || 'Unknown OAuth error';
            console.error('GitHub OAuth error: %s', errMsg);
            res.send(`
                <html><body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(String(errMsg))} }, ${JSON.stringify(targetOrigin)});
                        window.close();
                    } else {
                        window.location.href = '/?error=' + encodeURIComponent(${JSON.stringify(String(errMsg))});
                    }
                </script>
                <p>Authentication failed: ${String(errMsg).replace(/</g, '&lt;')}</p>
                </body></html>
            `);
            return;
        }

        // Bug fix #1+#2: Use JSON.stringify for the token value and restrict postMessage to known origin
        res.send(`
            <html>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: ${JSON.stringify(data.access_token)} }, ${JSON.stringify(targetOrigin)});
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
        console.error('OAuth callback error:', error);
        res.status(500).send("Authentication failed");
    }
});

// github-latest-beta logic
app.post("/api/github-latest-beta", async (req, res) => {
    console.log("Received request for /api/github-latest-beta");
    // SSRF Fix: Sanitize user input to prevent path traversal
    const owner = sanitizeInput(req.body.owner);
    const repo = sanitizeInput(req.body.repo);
    
    if (!owner || !repo) return res.status(400).json({ error: 'Invalid owner or repo' });

    const token = req.headers.authorization?.split(' ')[1] || process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
        'User-Agent': 'AppVersionTracker/1.0',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers });
        const releases = await response.json();
        
        // Bug fix #12: Guard against non-array responses (e.g. rate limit or 404 error objects)
        if (!Array.isArray(releases) || releases.length === 0) {
            return res.status(404).json({ error: 'No releases found', detail: releases?.message });
        }
        
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
// Bug fix #4: Default retries changed from 1 (no retry) to 3 (two actual retries)
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    // Basic safety check for fetch loop
    if (!url || !url.startsWith('http')) {
        throw new Error('Invalid URL provided to fetchWithRetry');
    }
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
        const cleanUrl = String(urlOrPackage).replace(/\/$/, '');
        if (!cleanUrl.includes('/')) {
            throw new Error('GitHub strategy requires a repository URL or owner/repo format');
        }
        
        // Bug fix #11: Extract only owner/repo — ignore any trailing path segments like /releases, /blob, etc.
        let owner: string, repo: string;
        const githubMatch = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (githubMatch) {
            owner = sanitizeInput(githubMatch[1]);
            repo = sanitizeInput(githubMatch[2]);
        } else {
            // Fallback: treat as plain "owner/repo" format
            const parts = cleanUrl.split('/');
            owner = sanitizeInput(parts[parts.length - 2]);
            repo = sanitizeInput(parts[parts.length - 1]);
        }

        if (!owner || !repo) throw new Error('Invalid GitHub owner or repo');
        
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
            const safeQuery = encodeURIComponent(urlOrPackage);
            const searchResponse = await fetchWithRetry(`https://www.apkmirror.com/?s=${safeQuery}&post_type=app_release`, { headers });
            const html = await searchResponse.text();
            const $ = cheerio.load(html);
            const firstResult = $('.appRow').first().find('.fontBlack').attr('href');
            if (!firstResult) throw new Error('No results found on APKMirror');
            downloadPageUrl = `https://www.apkmirror.com${firstResult}`;
        } else {
            // SSRF Fix: Validate domain
            if (!isValidDomain(downloadPageUrl, 'apkmirror.com')) {
                throw new Error('Invalid APKMirror URL');
            }
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
        const cleanUrl = String(urlOrPackage).replace(/\/$/, '');
        let packageName = cleanUrl.includes('/') ? cleanUrl.split('/').pop()! : cleanUrl;
        packageName = sanitizeInput(packageName); // SSRF Fix
        
        if (!packageName) throw new Error('Invalid F-Droid package name');

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
        const rawPackageName = String(urlOrPackage).includes('/') ? String(urlOrPackage).split('/').pop()! : String(urlOrPackage);
        const packageName = encodeURIComponent(rawPackageName); // SSRF / Injection Fix
        
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
            const cleanPackageName = sanitizeInput(packageName);
            const app = await gplay.app({ appId: cleanPackageName });
            return {
                version: app.version,
                downloadUrl: app.url,
                appName: app.title,
                iconUrl: app.icon,
                metadata: { channel }
            };
        } catch (error) {
            console.error("Error checking update with google-play-scraper for %s:", packageName, error);
            throw error;
        }
    },
    "aurora-store": async (packageName: string, channel: string) => {
        // Aurora Store uses Google Play as its backend
        try {
            const cleanPackageName = sanitizeInput(packageName);
            const app = await gplay.app({ appId: cleanPackageName });
            return {
                version: app.version,
                downloadUrl: app.url,
                appName: app.title,
                iconUrl: app.icon,
                metadata: { channel }
            };
        } catch (error) {
            console.error("Error checking update with google-play-scraper for %s:", packageName, error);
            throw error;
        }
    },
    mobilism: async (packageName: string, channel: string) => {
        // Mobilism is a forum, scraping is hard without login/cookies
        // We return a search link as a fallback
        const safePackage = encodeURIComponent(packageName);
        return { 
            version: 'Check Site', 
            downloadUrl: `https://forum.mobilism.org/search.php?keywords=${safePackage}&sr=topics&sf=titleonly`,
            appName: packageName,
            metadata: { channel }
        };
    },
    "samsung-store": async (packageName: string, channel: string) => {
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        try {
            const cleanPackage = sanitizeInput(packageName);
            const url = `https://galaxy.store/${cleanPackage}`;
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
                downloadUrl: `https://galaxy.store/${cleanPackage}`,
                appName: packageName,
                metadata: { channel }
            };
        } catch (error) {
            // Format String Fix
            console.error('Error checking Samsung Store for %s:', packageName, error);
            return {
                version: 'Check Store',
                downloadUrl: `https://galaxy.store/${sanitizeInput(packageName)}`,
                appName: packageName,
                metadata: { channel }
            };
        }
    },
    "neo-store": async (packageName: string, channel: string) => {
        // Neo Store uses F-Droid as its repository — same page, same selectors
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const cleanPackage = sanitizeInput(packageName);
        const response = await fetchWithRetry(`https://f-droid.org/en/packages/${cleanPackage}/`, { headers });
        const html = await response.text();
        const $ = cheerio.load(html);
        // Bug fix #13: Use the same selector as the f-droid strategy (.package-version-header b)
        const version = $('.package-version-header b').first().text().replace('Version ', '').trim();
        const appName = $('.package-header h3').first().text().trim() || packageName;
        const iconUrl = $('.package-header-image').attr('src');
        const apkLink = $('.package-version-download a').first().attr('href');
        const downloadUrl = apkLink || `https://f-droid.org/en/packages/${cleanPackage}/`;
        return { version, downloadUrl, appName, iconUrl, metadata: { channel } };
    },
    "unofficial-store": async (packageName: string, channel: string) => {
        // Fallback to APKMirror for unofficial stores
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        const safeQuery = encodeURIComponent(packageName);
        const searchResponse = await fetchWithRetry(`https://www.apkmirror.com/?s=${safeQuery}&post_type=app_release`, { headers });
        const html = await searchResponse.text();
        const $ = cheerio.load(html);
        const firstResult = $('.appRow').first().find('.fontBlack').attr('href');
        if (!firstResult) return { version: 'Latest (Store)', downloadUrl: `https://www.apkmirror.com/?s=${safeQuery}`, metadata: { channel } };
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
                console.error("Error checking update with %s:", s, error);
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
    if (typeof packageName !== 'string' || !packageName.trim()) {
        return res.status(400).json({ error: 'Package name is required' });
    }

    const cleanPackage = packageName.trim();
    if (!isValidPackageName(cleanPackage)) {
        return res.status(400).json({ error: 'Invalid package name format' });
    }

    console.log(`Resolving package name: ${cleanPackage}`);

    const headers = { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    try {
        // Try Google Play Store first
        const playUrl = `https://play.google.com/store/apps/details?id=${cleanPackage}&hl=en`;
        const response = await fetch(playUrl, { headers });
        
        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Play Store often has the app name in a specific h1 tag or meta tag
            let resolvedAppName = $('h1 span').first().text().trim() || $('h1').first().text().trim();
            
            // Fallback to meta tags if h1 fails
            if (!resolvedAppName) {
                resolvedAppName = $('meta[property="og:title"]').attr('content')?.split(' - ')[0]?.trim() || '';
            }

            if (resolvedAppName && resolvedAppName !== 'Google Play') {
                const iconUrl = $('img[alt="Icon image"]').attr('src') || $('meta[property="og:image"]').attr('content');
                return res.json({ appName: resolvedAppName, iconUrl, source: 'google-play' });
            }
        }

        // Try F-Droid as fallback
        const fdroidResponse = await fetch(`https://f-droid.org/en/packages/${cleanPackage}/`, { headers });
        if (fdroidResponse.ok) {
            const html = await fdroidResponse.text();
            const $ = cheerio.load(html);
            const resolvedAppName = $('.package-header h3').first().text().trim() || $('h3').first().text().trim();
            const iconUrl = $('.package-header-image').attr('src');
            if (resolvedAppName) {
                return res.json({ appName: resolvedAppName, iconUrl, source: 'f-droid' });
            }
        }

        return res.status(404).json({ error: 'Could not resolve package name' });
    } catch (error) {
        // Format String Fix
        console.error('Error resolving package %s:', packageName, error);
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
