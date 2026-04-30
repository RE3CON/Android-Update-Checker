import React, { useState, useMemo, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { GitHubConnect } from './components/GitHubConnect';
import { Plus, Trash2, ExternalLink, RefreshCw, Search, Upload, Github, Play, Smartphone, Download, ShoppingBag, Zap, Bug, Globe, Box, FileText, Share2, BarChart3, Clock, Calendar, ShieldCheck, Copy, Sparkles, Scale, Settings, CheckSquare, MoreHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppItem } from './types';
// Bug fix #14: removed unused `initialInventory` import (inventory starts as [])
import fullData from './fullData.json';

const sourceIcons: Record<string, React.ReactNode> = {
  github: <Github size={24} />,
  'google-play': <Play size={24} />,
  'f-droid': <Box size={24} />,
  apkmirror: <Download size={24} />,
  apkpure: <Download size={24} />,
  'samsung-store': <ShoppingBag size={24} />,
  'neo-store': <ShieldCheck size={24} />,
  'aurora-store': <Zap size={24} />,
  'unofficial-store': <Bug size={24} />,
  debug: <Bug size={24} />,
  other: <Globe size={24} />,
  mobilism: <Smartphone size={24} />,
  uptodown: <Download size={24} />,
  apkcombo: <Box size={24} />,
};

const formatVersion = (version: string | undefined | null) => {
  if (!version) return 'Unknown';
  const v = String(version);
  if (v.length <= 12) return v;
  
  // Extract logical version by stripping build metadata/suffixes
  // Matches . or - followed by letters (e.g., .admin, -beta, .pixel)
  const parts = v.split(/[\.-][a-zA-Z_]/);
  if (parts.length > 1 && parts[0].length > 0) {
    // Ensure we don't strip too much (e.g., if the version is just "beta-1.0")
    if (/\d/.test(parts[0])) {
      return parts[0];
    }
  }
  
  // If it's still too long, truncate it
  if (v.length > 20) {
    return v.substring(0, 20) + '...';
  }
  
  return v;
};

const categoryMap: Record<string, string> = {
  'com.android.vending': 'App Stores',
  'com.google.android.gms': 'System Tools',
  'com.google.android.googlequicksearchbox': 'Tools',
  'com.google.android.apps.maps': 'Navigation & Travel',
  'com.google.android.youtube': 'Media & Video',
  'com.google.android.apps.photos': 'Photography',
  'com.google.android.calendar': 'Productivity',
  'com.google.android.gm': 'Communication',
  'com.google.android.apps.messaging': 'Communication',
  'com.google.android.contacts': 'Communication',
  'com.google.android.dialer': 'Communication',
  'com.android.chrome': 'Web Browsers',
  'com.sec.android.app.sbrowser': 'Web Browsers',
  'org.mozilla.firefox': 'Web Browsers',
  'com.opera.browser': 'Web Browsers',
  'com.brave.browser': 'Web Browsers',
  'com.microsoft.emmx': 'Web Browsers',
  'com.duckduckgo.mobile.android': 'Web Browsers',
  'com.whatsapp': 'Communication',
  'org.telegram.messenger': 'Communication',
  'org.thoughtcrime.securesms': 'Communication',
  'com.facebook.katana': 'Social',
  'com.instagram.android': 'Social',
  'com.twitter.android': 'Social',
  'com.zhiliaoapp.musically': 'Social',
  'com.spotify.music': 'Music & Audio',
  'com.netflix.mediaclient': 'Media & Video',
  'com.disney.disneyplus': 'Media & Video',
  'com.amazon.mShop.android.shopping': 'Shopping',
  'com.ebay.mobile': 'Shopping',
  'com.paypal.android.p2pmobile': 'Finance',
  'com.revolut.revolut': 'Finance',
  'com.binance.dev': 'Finance',
  'com.coinbase.android': 'Finance',
  'com.supercell.clashofclans': 'Games',
  'com.king.candycrushsaga': 'Games',
  'com.nianticlabs.pokemongo': 'Games',
  'com.roblox.client': 'Games',
  'com.mojang.minecraftpe': 'Games',
  'com.adobe.reader': 'Productivity',
  'com.microsoft.office.word': 'Productivity',
  'com.microsoft.office.excel': 'Productivity',
  'com.microsoft.office.powerpoint': 'Productivity',
  'com.evernote': 'Productivity',
  'com.todoist': 'Productivity',
  'com.accuweather.android': 'Weather',
  'com.weather.Weather': 'Weather',
  'org.fdroid.fdroid': 'App Stores',
  'com.aurora.store': 'App Stores',
  'com.machiav3lli.fdroid': 'App Stores',
  'com.sec.android.app.myfiles': 'File Explorer',
  'com.google.android.apps.nbu.files': 'File Explorer',
  'pl.solidexplorer2': 'File Explorer',
  'com.ghisler.android.TotalCommander': 'File Explorer',
  'com.amaze.filemanager': 'File Explorer',
};

const guessCategory = (packageName: string, name: string): string => {
  const pkg = (packageName || '').toLowerCase();
  const nm = (name || '').toLowerCase();

  // 1. Direct Mapping (Highest Precision)
  if (categoryMap[pkg]) return categoryMap[pkg];

  // 2. Web Browsers
  if (
    pkg.includes('chrome') || 
    pkg.includes('chromium') || 
    pkg.includes('firefox') || 
    pkg.includes('sbrowser') || 
    pkg.includes('opera') || 
    pkg.includes('vivaldi') || 
    pkg.includes('brave') || 
    pkg.includes('browser') || 
    pkg.includes('kiwi') ||
    pkg.includes('puffin') ||
    pkg.includes('tor.browser') ||
    nm.includes('browser') ||
    nm.includes('web explorer')
  ) return 'Web Browsers';

  // 3. File Explorers
  if (
    pkg.includes('filemanager') || 
    pkg.includes('explorer') || 
    pkg.includes('files') || 
    pkg.includes('commander') ||
    pkg.includes('archiver') ||
    pkg.includes('unzip') ||
    nm.includes('file manager') || 
    nm.includes('explorer') || 
    nm.includes('files') ||
    nm.includes('storage')
  ) return 'File Explorer';

  // 4. System Tools & Settings
  if (
    pkg.includes('settings') || 
    pkg.includes('systemui') || 
    pkg.includes('android.providers') || 
    pkg.includes('google.android.gms') || 
    pkg.includes('samsung.android.app.settings') ||
    pkg.includes('config') ||
    pkg.includes('setupwizard') ||
    pkg.includes('packageinstaller') ||
    pkg.includes('service') ||
    nm.includes('settings') ||
    nm.includes('system tools') ||
    nm.includes('service')
  ) return 'System Tools';

  // 5. App Stores
  if (
    pkg.includes('vending') || 
    pkg.includes('store') || 
    pkg.includes('market') ||
    nm.includes('store') ||
    nm.includes('market') ||
    nm.includes('repository')
  ) return 'App Stores';

  // 6. Communication
  if (
    pkg.includes('whatsapp') || 
    pkg.includes('telegram') || 
    pkg.includes('signal') || 
    pkg.includes('msg') || 
    pkg.includes('messenger') || 
    pkg.includes('chat') ||
    pkg.includes('discord') ||
    pkg.includes('skype') ||
    pkg.includes('viber') ||
    pkg.includes('slack') ||
    nm.includes('messenger') || 
    nm.includes('chat') ||
    nm.includes('talk')
  ) return 'Communication';

  // 7. Social
  if (
    pkg.includes('facebook') || 
    pkg.includes('instagram') || 
    pkg.includes('twitter') || 
    pkg.includes('tiktok') || 
    pkg.includes('social') ||
    pkg.includes('reddit') ||
    pkg.includes('linkedin') ||
    pkg.includes('snapchat') ||
    pkg.includes('pinterest') ||
    nm.includes('social')
  ) return 'Social';

  // 8. Media & Video
  if (
    pkg.includes('youtube') || 
    pkg.includes('netflix') || 
    pkg.includes('video') || 
    pkg.includes('vlc') ||
    pkg.includes('player') ||
    pkg.includes('streaming') ||
    pkg.includes('hulu') ||
    pkg.includes('disney') ||
    nm.includes('player') || 
    nm.includes('tv') ||
    nm.includes('cinema')
  ) return 'Media & Video';

  // 9. Music & Audio
  if (
    pkg.includes('spotify') || 
    pkg.includes('music') || 
    pkg.includes('audio') || 
    pkg.includes('podcast') ||
    pkg.includes('mp3') ||
    pkg.includes('sound') ||
    pkg.includes('radio') ||
    nm.includes('music') ||
    nm.includes('audio')
  ) return 'Music & Audio';

  // 10. Navigation & Travel
  if (
    pkg.includes('maps') || 
    pkg.includes('navigation') || 
    pkg.includes('gps') || 
    pkg.includes('uber') || 
    pkg.includes('travel') ||
    pkg.includes('flight') ||
    pkg.includes('hotel') ||
    nm.includes('map') ||
    nm.includes('gps') ||
    nm.includes('navigation')
  ) return 'Navigation & Travel';

  // 11. Finance
  if (
    pkg.includes('bank') || 
    pkg.includes('finance') || 
    pkg.includes('pay') || 
    pkg.includes('wallet') || 
    pkg.includes('crypto') ||
    pkg.includes('stock') ||
    pkg.includes('trading') ||
    nm.includes('bank') ||
    nm.includes('finance') ||
    nm.includes('wallet')
  ) return 'Finance';

  // 12. Games
  if (
    pkg.includes('game') || 
    pkg.includes('nintendo') || 
    pkg.includes('niantic') || 
    pkg.includes('roblox') ||
    pkg.includes('unity') ||
    pkg.includes('epicgames') ||
    pkg.includes('steam') ||
    nm.includes('game') ||
    nm.includes('arcade') ||
    nm.includes('puzzle')
  ) return 'Games';

  // 13. Health & Fitness
  if (
    pkg.includes('health') || 
    pkg.includes('fitness') || 
    pkg.includes('fit') || 
    pkg.includes('workout') ||
    pkg.includes('gym') ||
    nm.includes('health') ||
    nm.includes('fitness')
  ) return 'Health & Fitness';

  // 14. Photography
  if (
    pkg.includes('photo') || 
    pkg.includes('camera') || 
    pkg.includes('gallery') || 
    pkg.includes('image') ||
    pkg.includes('editor') ||
    pkg.includes('filter') ||
    nm.includes('camera') ||
    nm.includes('photo')
  ) return 'Photography';

  // 15. Productivity
  if (
    pkg.includes('mail') || 
    pkg.includes('calendar') || 
    pkg.includes('notes') || 
    pkg.includes('office') || 
    pkg.includes('document') || 
    pkg.includes('pdf') ||
    pkg.includes('scan') ||
    pkg.includes('task') ||
    nm.includes('note') ||
    nm.includes('productivity')
  ) return 'Productivity';

  // 16. Security
  if (
    pkg.includes('vpn') || 
    pkg.includes('security') || 
    pkg.includes('antivirus') ||
    pkg.includes('proxy') ||
    pkg.includes('firewall') ||
    pkg.includes('adblock') ||
    nm.includes('security') ||
    nm.includes('vpn')
  ) return 'Security';

  // 17. System Apps (General fallback)
  if (pkg.includes('system') || nm.includes('system')) return 'System Apps';

  // 18. Other Categories
  if (pkg.includes('weather') || nm.includes('weather')) return 'Weather';
  if (pkg.includes('news') || nm.includes('news')) return 'News & Magazines';
  if (pkg.includes('shopping') || pkg.includes('amazon') || pkg.includes('ebay') || nm.includes('shop')) return 'Shopping';
  if (pkg.includes('tool') || pkg.includes('util') || nm.includes('tool')) return 'Tools';
  if (pkg.includes('edu') || nm.includes('learn') || nm.includes('school')) return 'Education';
  if (pkg.includes('book') || nm.includes('read') || nm.includes('library')) return 'Books & Reference';
  if (pkg.includes('launcher') || nm.includes('launcher') || nm.includes('theme')) return 'Personalization';
  if (pkg.includes('wallet') || pkg.includes('bank') || nm.includes('pay')) return 'Finance';
  if (pkg.includes('fitness') || pkg.includes('health') || nm.includes('run')) return 'Health & Fitness';
  if (pkg.includes('samsung') || pkg.includes('sec.android')) return 'Samsung System';
  if (pkg.includes('google.android')) return 'Google System';

  return 'Other';
};

const getStoreUrl = (app: AppItem): string => {
  if (app.updateUrl && app.updateUrl.startsWith('http')) return app.updateUrl;
  
  switch (app.source) {
    case 'google-play': return `https://play.google.com/store/apps/details?id=${app.packageName}`;
    case 'f-droid': return `https://f-droid.org/en/packages/${app.packageName}/`;
    case 'samsung-store': return `samsungapps://ProductDetail/${app.packageName}`;
    case 'apkmirror': return `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${app.packageName}`;
    case 'apkpure': return `https://apkpure.com/search?q=${app.packageName}`;
    case 'mobilism': return `https://app.mobilism.org/?q=${encodeURIComponent(app.name || app.packageName)}`;
    case 'github': return `https://github.com/search?q=${app.packageName}`;
    case 'uptodown': return `https://www.uptodown.com/android/search/${app.packageName}`;
    case 'apkcombo': return `https://apkcombo.com/search/${app.packageName}`;
    default: return app.updateUrl || '';
  }
};

export default function App() {
  const [inventory, setInventory] = useState<AppItem[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newPackageName, setNewPackageName] = useState('');
  const [newAppCategory, setNewAppCategory] = useState('');
  const [newAppSource, setNewAppSource] = useState('github');
  const [sortBy, setSortBy] = useState('name-asc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedAppIds, setExpandedAppIds] = useState<Set<string>>(new Set());
  const [isScrolled, setIsScrolled] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [appManagerUrl, setAppManagerUrl] = useState('https://github.com/MuntashirAkon/AppManager/releases');

  // Fetch latest App Manager release
  useEffect(() => {
    const fetchLatestAppManager = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/MuntashirAkon/AppManager/releases/latest');
        if (!response.ok) return;
        const data = await response.json();
        if (data.assets && data.assets.length > 0) {
          const apkAsset = data.assets.find((a: any) => a.name.toLowerCase().endsWith('.apk'));
          if (apkAsset) {
            setAppManagerUrl(apkAsset.browser_download_url);
          } else {
            setAppManagerUrl(data.html_url);
          }
        } else {
          setAppManagerUrl(data.html_url);
        }
      } catch (error) {
        console.error('Error fetching App Manager release:', error);
      }
    };
    fetchLatestAppManager();
  }, []);

  const isPackageName = (name: string) => {
    return name.includes('.') && !name.includes(' ');
  };

  const isValidPackageName = (packageName: string): boolean => {
    return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName);
  };

  const prettifyPackageName = (pkg: string) => {
    if (!pkg) return "Unknown App";
    let clean = pkg.replace(/^(com|org|net|de|ru|app|io|dev|vendor|at|uk|ca|me)\./i, '');
    clean = clean.replace(/^(android|google|samsung|sec|qualcomm|qti|ghisler|microsoft|adobe|facebook|instagram|whatsapp|amazon|spotify|netflix|disney|revolut|binance|coinbase|supercell|king|niantic|roblox|mojang)\./i, '');
    clean = clean.replace(/^(android|app|provider|service|internal|overlay|hardware|system|ui|apps|mobile|client|messenger|social|video|music|audio|navigation|travel|finance|games|health|fitness|photo|productivity|security|weather|news|shopping|tools|edu|book|launcher)\./i, '');
    let words = clean.replace(/[._]/g, ' ');
    // Remove standalone numbers and small particles
    words = words.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();
    return words.replace(/\b\w/g, char => char.toUpperCase()) || pkg;
  };

  // Handle scroll for One UI header effect
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedAppIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredInventory = useMemo(() => {
    const filtered = inventory.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            app.packageName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSource = filterSource === 'all' || app.source === filterSource;
      const matchesCategory = filterCategory === 'all' || (app.category === filterCategory) || (filterCategory === 'uncategorized' && !app.category);
      return matchesSearch && matchesSource && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'install-date': {
          const dateA = a.installationDate ? new Date(a.installationDate).getTime() : 0;
          const dateB = b.installationDate ? new Date(b.installationDate).getTime() : 0;
          return dateB - dateA; // Newest first
        }
        case 'source':
          return a.source.localeCompare(b.source);
        case 'unknown': {
          const isAUnknown = a.name === 'Unknown App' || isPackageName(a.name);
          const isBUnknown = b.name === 'Unknown App' || isPackageName(b.name);
          if (isAUnknown && !isBUnknown) return -1;
          if (!isAUnknown && isBUnknown) return 1;
          return a.name.localeCompare(b.name);
        }
        default:
          return 0;
      }
    });
  }, [inventory, searchTerm, filterSource, filterCategory, sortBy]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(app => {
      if (app.category) cats.add(app.category);
    });
    return Array.from(cats).sort();
  }, [inventory]);

  const compareVersions = (v1: string, v2: string) => {
    if (v1 === v2) return 0;
    
    // Clean versions: remove 'v' prefix, extra spaces, etc.
    const cleanV1 = v1.replace(/^[vV]/, '').trim();
    const cleanV2 = v2.replace(/^[vV]/, '').trim();
    
    if (cleanV1 === cleanV2) return 0;

    // Split by dots or hyphens
    const parts1 = cleanV1.split(/[.-]/);
    const parts2 = cleanV2.split(/[.-]/);
    
    const length = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < length; i++) {
      const p1 = parts1[i] || '0';
      const p2 = parts2[i] || '0';
      
      const n1 = parseInt(p1, 10);
      const n2 = parseInt(p2, 10);
      
      // Bug fix #10: Only use numeric comparison when parseInt consumed the entire token.
      // parseInt('34beta') === 34, which would incorrectly equate '34beta' with '34'.
      const p1IsNumeric = !isNaN(n1) && String(n1) === p1;
      const p2IsNumeric = !isNaN(n2) && String(n2) === p2;
      
      if (p1IsNumeric && p2IsNumeric) {
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
      } else {
        // String comparison fallback for mixed or purely alphabetic tokens
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
      }
    }
    return 0;
  };

  const checkUpdate = async (id: string) => {
    const app = inventory.find(a => a.id === id);
    if (!app) return;

    // Capture previous status to restore it on error
    const prevStatus = app.status;
    setInventory(prev => prev.map(a => a.id === id ? { ...a, status: 'checking' } : a));

    try {
      const token = localStorage.getItem('github_token');
      const response = await fetch(`/api/check-update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ source: app.source, packageName: app.packageName, updateUrl: app.updateUrl, appName: app.name })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to check update: ${response.status} ${errorText}`);
      }
      
      const { latestVersion, updateUrl, appName: resolvedName, iconUrl } = await response.json();
      
      let status: 'update-available' | 'up-to-date' = 'up-to-date';
      const specialStrings = ['Latest (Store)', 'Check Store', 'Check Site', 'Varies with device', 'VARY', 'Unknown'];
      if (latestVersion && !specialStrings.includes(latestVersion)) {
        status = compareVersions(latestVersion, app.currentVersion) > 0 ? 'update-available' : 'up-to-date';
      }
      
      setInventory(prev => prev.map(a => a.id === id ? { 
        ...a, 
        status, 
        latestVersion: latestVersion || a.latestVersion, 
        updateUrl: updateUrl || a.updateUrl,
        iconUrl: iconUrl || a.iconUrl,
        name: (isPackageName(a.name) || a.name === 'Unknown App') && resolvedName && !isPackageName(resolvedName) ? resolvedName : a.name
      } : a));
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking update for app:', app.name, 'ID:', id, 'Error:', error);
      // Bug fix #5: Restore previous status instead of silently marking as up-to-date
      setInventory(prev => prev.map(a => a.id === id ? { ...a, status: prevStatus === 'checking' ? 'up-to-date' : prevStatus } : a));
    }
  };

  const copyUpdatesToClipboard = () => {
    const updates = inventory.filter(app => app.status === 'update-available');
    if (updates.length === 0) {
      alert('No updates available to copy.');
      return;
    }
    
    const text = updates.map(app => `${app.name} (${app.packageName})\nCurrent: ${app.currentVersion} -> Latest: ${app.latestVersion}\nURL: ${app.updateUrl || 'N/A'}\n`).join('\n---\n\n');
    
    navigator.clipboard.writeText(text).then(() => {
      alert('Updates copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const [checkingProgress, setCheckingProgress] = useState<number>(0);
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);

  // Bug fix #16: wrap in useCallback so the setInterval effect captures a stable reference
  const checkAllUpdates = useCallback(async () => {
    // Bug fix #6: guard against concurrent runs triggered by the interval + manual button
    if (isCheckingAll) return;
    setIsCheckingAll(true);
    setCheckingProgress(0);
    
    // Define priority for sources
    const sourcePriority: Record<string, number> = {
      'google-play': 1,
      'samsung-store': 2,
      // All other sources default to 3
    };

    // Filter out Mobilism and APKMirror for automatic checks
    const appsToCheck = inventory.filter(app => 
      app.source !== 'mobilism' && app.source !== 'apkmirror'
    ).sort((a, b) => {
      const p1 = sourcePriority[a.source] || 3;
      const p2 = sourcePriority[b.source] || 3;
      return p1 - p2;
    });

    if (appsToCheck.length === 0) {
      setIsCheckingAll(false);
      return;
    }

    for (let i = 0; i < appsToCheck.length; i++) {
      await checkUpdate(appsToCheck[i].id);
      setCheckingProgress(((i + 1) / appsToCheck.length) * 100);
    }
    setLastChecked(new Date());
    setIsCheckingAll(false);
  }, [isCheckingAll, inventory]);

  // Bug fix #7: Only auto-check once on first load, not on every length change
  // (e.g. deleting one app previously triggered a full re-check of everything)
  const hasAutoChecked = useRef(false);
  React.useEffect(() => {
    if (inventory.length > 0 && !hasAutoChecked.current) {
      hasAutoChecked.current = true;
      checkAllUpdates();
    }
  }, [inventory.length, checkAllUpdates]);

  const updatesAvailable = useMemo(() => inventory.filter(app => app.status === 'update-available').length, [inventory]);

  const stats = useMemo(() => {
    const total = inventory.length;
    const sources = inventory.reduce((acc, app) => {
      acc[app.source] = (acc[app.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostCommonSource = Object.entries(sources).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A';
    
    return { total, mostCommonSource, updatesAvailable };
  }, [inventory, updatesAvailable]);

  const exportToExcel = () => {
    const data = inventory.map(app => ({
      Name: app.name,
      'Package Name': app.packageName,
      Category: app.category || 'Uncategorized',
      'Current Version': app.currentVersion,
      'Latest Version': app.latestVersion || 'N/A',
      Source: app.source,
      'Update URL': app.updateUrl,
      'Installation Date': app.installationDate || 'N/A',
      'Last Update': app.lastUpdateTime || 'N/A',
      'Min SDK': app.minSdk || 'N/A',
      'Target SDK': app.targetSdk || 'N/A'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "AppTracker_Inventory.xlsx");
  };

  const exportToCSV = () => {
    const data = inventory.map(app => ({
      Name: app.name,
      Package: app.packageName,
      Category: app.category || 'Uncategorized',
      Version: app.currentVersion,
      Latest: app.latestVersion || 'N/A',
      Source: app.source,
      Installed: app.installationDate || 'N/A',
      Updated: app.lastUpdateTime || 'N/A'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "AppTracker_Inventory.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Bug fix #17: revoke the object URL to prevent memory leak
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Universal App Tracker Inventory", 14, 15);
    
    const tableData = inventory.map(app => [
      app.name,
      app.packageName,
      app.category || '-',
      app.currentVersion,
      app.source,
      app.status
    ]);
    
    autoTable(doc, {
      head: [['Name', 'Package', 'Category', 'Version', 'Source', 'Status']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 255] },
      columnStyles: {
        0: { cellWidth: 35 }, // Name
        1: { cellWidth: 'auto' }, // Package
        2: { cellWidth: 20 }, // Category
        3: { cellWidth: 20 }, // Version
        4: { cellWidth: 20 }, // Source
        5: { cellWidth: 20 }  // Status
      },
      styles: { overflow: 'linebreak' }
    });
    
    doc.save("AppTracker_Inventory.pdf");
  };

  const copySummary = () => {
    const summary = `App Tracker Summary:
Total Apps: ${stats.total}
Updates Available: ${stats.updatesAvailable}
Top Source: ${stats.mostCommonSource}

Generated on ${new Date().toLocaleDateString()}`;
    
    navigator.clipboard.writeText(summary);
    alert("Summary copied to clipboard!");
  };

  const shareInventory = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My App Inventory',
          text: `I'm tracking ${inventory.length} apps with App Tracker!`,
          url: window.location.href
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('Sharing is not supported on this browser');
    }
  };

  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [isResolvingAll, setIsResolvingAll] = useState(false);

  const resolvePackage = async (id: string, packageName: string) => {
    if (resolvingIds.has(id)) return;
    
    setResolvingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch('/api/resolve-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.appName) {
          setInventory(prev => prev.map(app => 
            app.id === id ? { ...app, name: data.appName, source: data.source || app.source, iconUrl: data.iconUrl || app.iconUrl } : app
          ));
        }
      } else {
        // Fallback to prettifyPackageName if API fails (e.g. for system apps)
        const fallbackName = prettifyPackageName(packageName);
        setInventory(prev => prev.map(app => 
          app.id === id ? { ...app, name: fallbackName } : app
        ));
      }
    } catch (error) {
      console.error(`Failed to resolve ${packageName}:`, error);
      // Fallback on network error
      const fallbackName = prettifyPackageName(packageName);
      setInventory(prev => prev.map(app => 
        app.id === id ? { ...app, name: fallbackName } : app
      ));
    } finally {
      setResolvingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const resolveAllUnknown = async (apps?: AppItem[]) => {
    if (isResolvingAll) return;
    
    const list = apps || inventory;
    const unknownApps = list.filter(app => (app.name === 'Unknown App' || isPackageName(app.name)) && !resolvingIds.has(app.id));
    
    if (unknownApps.length === 0) return;

    setIsResolvingAll(true);
    try {
      // Process in batches of 5 to avoid overwhelming the server/APIs
      const batchSize = 5;
      for (let i = 0; i < unknownApps.length; i += batchSize) {
        const batch = unknownApps.slice(i, i + batchSize);
        await Promise.all(batch.map(app => resolvePackage(app.id, app.packageName)));
        // Wait a bit between batches
        if (i + batchSize < unknownApps.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } finally {
      setIsResolvingAll(false);
    }
  };

  // Resolve unknown apps on mount or when inventory changes significantly
  // Bug fix #9: Use a ref so this only runs once on mount, not on every inventory mutation
  // (resolving an app mutates inventory, which previously caused a re-run loop)
  const hasAutoResolved = useRef(false);
  React.useEffect(() => {
    if (inventory.length > 0 && !hasAutoResolved.current && !isResolvingAll) {
      const unknownCount = inventory.filter(app => app.name === 'Unknown App' || isPackageName(app.name)).length;
      if (unknownCount > 0) {
        hasAutoResolved.current = true;
        resolveAllUnknown();
      }
    }
  }, [inventory.length, isResolvingAll]);

  const addApp = () => {
    if (!newAppName || !newAppUrl) {
        alert('Please enter name and URL');
        return;
    }
    const pkgName = newPackageName || (isPackageName(newAppName) ? newAppName : newAppName.toLowerCase().replace(/[^a-z0-9]/g, '.'));
    const newApp: AppItem = {
        // Bug fix #8: use crypto.randomUUID() to avoid Date.now() collisions on rapid adds
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        name: newAppName,
        currentVersion: '1.0.0',
        updateUrl: newAppUrl,
        source: newAppSource as any,
        status: 'up-to-date',
        category: newAppCategory || guessCategory(pkgName, newAppName),
        packageName: pkgName
    };
    setInventory(prev => [...prev, newApp]);
    setNewAppName('');
    setNewAppUrl('');
    setNewPackageName('');
    setNewAppCategory('');
  };

  const fetchLatestBeta = async () => {
    try {
      const token = localStorage.getItem('github_token');
      const response = await fetch(`/api/github-latest-beta`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ owner: githubOwner, repo: githubRepo })
      });
      const artifact = await response.json();
      if (artifact && artifact.archive_download_url) {
        const newApp: AppItem = {
          id: artifact.id.toString(),
          name: artifact.name,
          currentVersion: 'Beta',
          updateUrl: artifact.archive_download_url,
          source: 'github',
          status: 'up-to-date',
          category: guessCategory(artifact.name, artifact.name),
          packageName: artifact.name
        };
        setInventory(prev => [...prev, newApp]);
      } else {
        alert('No beta artifact found or invalid URL.');
      }
    } catch (error) {
      console.error('Error fetching from GitHub:', error);
      alert('Failed to fetch from GitHub.');
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        console.log('File content:', content.substring(0, 100) + '...');
        
        let importedApps: AppItem[] = [];
        
        // Try parsing as JSON first
        try {
          const json = JSON.parse(content);
          console.log('Parsed JSON:', json);
          
          if (!Array.isArray(json)) {
            throw new Error('Imported JSON must be an array of apps.');
          }

          importedApps = json.map((app: any, index: number) => {
            const packageName = app.packageName || app.name || app.id || 'unknown';
            let displayName = app.label || app.appName || packageName;
            
            const formatDate = (ts: any) => {
              if (!ts) return undefined;
              const num = Number(ts);
              if (isNaN(num) || num <= 0) return String(ts);
              return new Date(num).toLocaleDateString();
            };

            let source: any = 'other';
            const rawSource = (app.source || '').toLowerCase();
            const installerName = (app.installerPackageName || '').toLowerCase();
            const installerLabel = (app.installerPackageLabel || '').toLowerCase();
            const pkg = packageName.toLowerCase();

            // Priority 1: Installer Package Name
            if (installerName === 'com.android.vending' || installerLabel.includes('play store')) {
              source = 'google-play';
            } else if (installerName === 'com.sec.android.app.samsungapps' || installerLabel.includes('galaxy store')) {
              source = 'samsung-store';
            } else if (installerName === 'org.fdroid.fdroid' || installerLabel.includes('f-droid')) {
              source = 'f-droid';
            } else if (installerName === 'com.machiav3lli.fdroid' || installerLabel.includes('neo store')) {
              source = 'neo-store';
            } else if (installerName === 'com.aurora.store' || installerLabel.includes('aurora store')) {
              source = 'aurora-store';
            } else if (installerName === 'com.apkmirror.helper.prod' || installerLabel.includes('apkmirror')) {
              source = 'apkmirror';
            } else if (installerName.includes('mobilism') || installerLabel.includes('mobilism')) {
              source = 'mobilism';
            } else if (installerName.includes('github') || installerLabel.includes('github')) {
              source = 'github';
            }
            // Priority 2: Raw Source field
            else if (rawSource.includes('play')) {
              source = 'google-play';
            } else if (rawSource.includes('galaxy') || rawSource.includes('samsung')) {
              source = 'samsung-store';
            } else if (rawSource.includes('f-droid')) {
              source = 'f-droid';
            } else if (rawSource.includes('github')) {
              source = 'github';
            }
            // Priority 3: Package Name patterns
            else if (pkg.includes('github')) {
              source = 'github';
            } else if (pkg.startsWith('com.google.android') && !pkg.includes('vending')) {
              source = 'google-play';
            } else if (pkg.startsWith('com.samsung.android') || pkg.startsWith('com.sec.android')) {
              source = 'samsung-store';
            }

            let updateUrl = app.updateUrl || '';
            if (!updateUrl) {
              if (source === 'google-play') {
                updateUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
              } else if (source === 'f-droid') {
                updateUrl = `https://f-droid.org/en/packages/${packageName}/`;
              } else if (source === 'apkmirror') {
                updateUrl = `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${packageName}`;
              } else if (source === 'samsung-store') {
                updateUrl = `https://apps.samsung.com/appquery/appDetail.as?appId=${packageName}`;
              }
            }
            
            return {
              id: packageName || `imported-${Date.now()}-${index}`,
              name: displayName,
              currentVersion: app.versionName || app.version || '0.0.0',
              updateUrl: updateUrl,
              source: source,
              status: 'up-to-date',
              category: app.category || guessCategory(packageName, displayName),
              packageName: packageName,
              installationDate: formatDate(app.firstInstallTime || app.installationDate || app.installedAt),
              lastUpdateTime: formatDate(app.lastUpdateTime || app.updatedAt),
              minSdk: String(app.minSdk || app.minSdkVersion || ''),
              targetSdk: String(app.targetSdk || app.targetSdkVersion || ''),
              versionCode: String(app.versionCode || ''),
              signature: app.signature || '',
              iconUrl: app.iconUrl || app.icon || app.thumbnail || app.image || undefined
            };
          });
        } catch (jsonError) {
          // If JSON fails, try parsing as SD Maid log
          console.log('JSON parse failed, trying SD Maid log parse...');
          const match = content.match(/getRunningPackages\(\)=\[(.*?)\]/);
          if (match) {
            const packagesString = match[1];
            const regex = /pkgId=([^,]+)/g;
            let pkgMatch;
            const pkgIds = [];
            while ((pkgMatch = regex.exec(packagesString)) !== null) {
              pkgIds.push(pkgMatch[1]);
            }
            
            if (pkgIds.length > 0) {
              // Create a map for quick lookup from fullData
              const appMap = new Map((fullData as any[]).map((app: any) => [app.name, app]));
              
              importedApps = pkgIds.map((packageName, index) => {
                const appInfo = appMap.get(packageName);
                const displayName = appInfo?.label || prettifyPackageName(packageName);
                
                return {
                  id: packageName || `imported-sdmaid-${Date.now()}-${index}`,
                  name: displayName,
                  currentVersion: appInfo?.versionName || '0.0.0',
                  updateUrl: '',
                  source: 'debug' as any,
                  status: 'up-to-date' as any,
                  category: appInfo?.category || guessCategory(packageName, displayName),
                  packageName: packageName,
                  versionCode: String(appInfo?.versionCode || ''),
                  minSdk: String(appInfo?.minSdk || ''),
                  targetSdk: String(appInfo?.targetSdk || ''),
                  signature: appInfo?.signature || '',
                };
              });
            } else {
              throw new Error('No package IDs found in SD Maid log.');
            }
          } else {
            // Try parsing as APKUpdater text log
            console.log('SD Maid parse failed, trying APKUpdater log parse...');
            
            // APKUpdater format:
            // App: [Label]
            // Package: [Package]
            // Version: [Version]
            // ...
            const apps: AppItem[] = [];
            const blocks = content.split(/App:\s+/);
            
            blocks.forEach((block, index) => {
              if (!block.trim()) return;
              
              const lines = block.split('\n');
              const name = lines[0].trim();
              const pkgMatch = block.match(/Package:\s+([^\n]+)/);
              const verMatch = block.match(/Version:\s+([^\n]+)/);
              const installerMatch = block.match(/Installer:\s+([^\n]+)/);
              
              if (pkgMatch) {
                const packageName = pkgMatch[1].trim();
                const version = verMatch ? verMatch[1].trim() : '0.0.0';
                const installer = installerMatch ? installerMatch[1].trim().toLowerCase() : '';
                
                let source: any = 'other';
                if (installer.includes('vending') || installer.includes('play')) source = 'google-play';
                else if (installer.includes('samsung')) source = 'samsung-store';
                else if (installer.includes('fdroid')) source = 'f-droid';
                else if (installer.includes('github')) source = 'github';
                
                apps.push({
                  id: packageName || `imported-apkupdater-${Date.now()}-${index}`,
                  name: name || prettifyPackageName(packageName),
                  currentVersion: version,
                  updateUrl: '',
                  source: source,
                  status: 'up-to-date',
                  category: guessCategory(packageName, name),
                  packageName: packageName
                });
              }
            });

            if (apps.length > 0) {
              importedApps = apps;
            } else {
              // Try a simpler format: [Label] ([Package])
              const simpleRegex = /^(.+)\s\((.+)\)$/gm;
              let match;
              while ((match = simpleRegex.exec(content)) !== null) {
                const name = match[1].trim();
                const packageName = match[2].trim();
                if (isValidPackageName(packageName)) {
                  apps.push({
                    id: packageName || `imported-simple-${Date.now()}-${apps.length}`,
                    name: name,
                    currentVersion: '0.0.0',
                    updateUrl: '',
                    source: 'other',
                    status: 'up-to-date',
                    category: guessCategory(packageName, name),
                    packageName: packageName
                  });
                }
              }
              
              if (apps.length > 0) {
                importedApps = apps;
              } else {
                throw jsonError;
              }
            }
          }
        }
        
        if (importedApps.length === 0) {
          alert('No apps found to import.');
          return;
        }

        setInventory(prev => {
          const existingPackages = new Set(prev.map(a => a.packageName));
          const newApps = importedApps.filter(a => !existingPackages.has(a.packageName));
          // Bug fix #7: removed duplicate setTimeout(checkAllUpdates) here.
          // The auto-check useEffect (hasAutoChecked ref) handles the first run;
          // subsequent imports will not re-trigger a full check automatically,
          // but the user can click 'Check All' manually.
          return [...prev, ...newApps];
        });
        
        alert(`Successfully imported ${importedApps.length} apps.`);
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Failed to parse file. Please check the Wiki for supported formats (App Manager JSON or SD Maid SE logs).');
      }
    };
    reader.readAsText(file);
  };

  const updateAppSource = (id: string, newSource: string) => {
    setInventory(prev => prev.map(app => app.id === id ? { ...app, source: newSource as any } : app));
  };

  const updateAppCategory = (id: string, newCategory: string) => {
    setInventory(prev => prev.map(app => app.id === id ? { ...app, category: newCategory } : app));
  };

  const [showSettings, setShowSettings] = useState(false);
  const [checkInterval, setCheckInterval] = useState<number>(24);

  // Bug fix #16: checkAllUpdates is now stable (useCallback), so the interval won't capture a stale closure
  useEffect(() => {
    const interval = setInterval(() => {
      checkAllUpdates();
    }, checkInterval * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkInterval, checkAllUpdates]);

  return (
    <div className="min-h-screen bg-samsung-gray-50 dark:bg-samsung-gray-950 p-2 sm:p-8 font-sans text-samsung-gray-900 dark:text-white transition-colors duration-500">
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-samsung-gray-900 p-6 rounded-3xl shadow-2xl w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Settings</h2>
            <label className="block text-sm font-bold mb-2">Check Interval (hours)</label>
            <input 
              type="number" 
              value={checkInterval} 
              onChange={(e) => setCheckInterval(Number(e.target.value))}
              className="w-full p-3 rounded-2xl bg-samsung-gray-100 dark:bg-white/5 mb-6"
            />
            <button 
              onClick={() => setShowSettings(false)}
              className="w-full py-3 rounded-2xl bg-samsung-blue text-white font-bold"
            >
              Save
            </button>
          </div>
        </div>
      )}
      {/* One UI 8.5 Header */}
      <header 
        className={`sticky top-0 z-50 transition-all duration-500 px-6 py-4 ${
          isScrolled 
            ? 'glass shadow-lg shadow-samsung-blue/10 py-3' 
            : 'bg-samsung-gray-50 dark:bg-samsung-gray-950'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className={`relative transition-all duration-500 ${isScrolled ? 'w-10 h-10' : 'w-16 h-16'} rounded-2xl overflow-hidden shadow-2xl shadow-samsung-blue/40 border border-white/20`}>
              <div className="w-full h-full bg-gradient-to-br from-samsung-blue to-blue-700 flex items-center justify-center text-white">
                <Sparkles size={isScrolled ? 20 : 32} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            </div>
            <div className="flex flex-col">
              <h1 className={`font-bold tracking-tight transition-all duration-500 ${isScrolled ? 'text-xl' : 'text-2xl sm:text-4xl'}`}>
                Universal App Tracker
              </h1>
              {!isScrolled && (
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-[10px] sm:text-sm text-stone-400 font-bold uppercase tracking-[0.3em] opacity-80">
                    Professional Android Inventory Hub
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GitHubConnect />
            <button 
              onClick={() => {
                alert('Wiki sync is now automated! Any changes you make in the /wiki folder will be pushed to GitHub, and any changes on GitHub Wiki will be pulled back here automatically via GitHub Actions.');
              }}
              className="p-2.5 rounded-full bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10 transition-all duration-300 active:scale-90"
              title="Wiki Sync Status"
            >
              <FileText size={20} />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-full bg-samsung-gray-100 dark:bg-white/5 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/10 transition-all duration-300 active:scale-90"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={checkAllUpdates}
              className="p-2.5 rounded-full bg-samsung-blue/10 text-samsung-blue hover:bg-samsung-blue hover:text-white transition-all duration-300 active:scale-90"
              title="Refresh all"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6 px-2 sm:px-6 pb-20 pt-6">
        {/* Stats Summary */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-6" aria-label="Statistics">
          <div className="glass p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm glow-blue-hover flex items-center gap-2.5 sm:gap-4 transition-all duration-300">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-samsung-blue/10 flex items-center justify-center shrink-0">
              <Smartphone className="text-samsung-blue" size={isScrolled ? 14 : 20} />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold tabular-nums truncate">{stats.total}</div>
              <div className="text-[7px] sm:text-[10px] uppercase font-bold text-stone-400 tracking-widest truncate">Total Apps</div>
            </div>
          </div>
          <div className="glass p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm glow-blue-hover flex items-center gap-2.5 sm:gap-4 transition-all duration-300">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <RefreshCw className="text-amber-500" size={isScrolled ? 14 : 20} />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold tabular-nums truncate">{stats.updatesAvailable}</div>
              <div className="text-[7px] sm:text-[10px] uppercase font-bold text-stone-400 tracking-widest truncate">Updates</div>
            </div>
          </div>
          <div className="glass p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm glow-blue-hover flex items-center gap-2.5 sm:gap-4 transition-all duration-300 col-span-2 sm:col-span-1">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Zap className="text-emerald-500" size={isScrolled ? 14 : 20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold truncate">
                {lastChecked ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
              </div>
              <div className="text-[7px] sm:text-[10px] uppercase font-bold text-stone-400 tracking-widest truncate">Last Checked</div>
            </div>
          </div>
        </section>

        {/* Quick Actions Card */}
        <section className="glass rounded-3xl sm:rounded-[3rem] p-3.5 sm:p-8 shadow-sm glow-border space-y-4 sm:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input 
                type="text" 
                placeholder="Search apps..." 
                className="w-full rounded-xl sm:rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-2 sm:py-3 pl-10 pr-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)} 
              className="w-full rounded-xl sm:rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-2.5 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all appearance-none"
            >
                <option value="all">All Categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
            <select 
              value={filterSource} 
              onChange={(e) => setFilterSource(e.target.value)} 
              className="w-full rounded-xl sm:rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-2.5 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all appearance-none"
            >
                <option value="all">All Sources</option>
                <option value="github">GitHub</option>
                <option value="apkmirror">APKMirror</option>
                <option value="apkpure">APKPure</option>
                <option value="google-play">Play Store</option>
                <option value="samsung-store">Samsung Store</option>
                <option value="f-droid">F-Droid</option>
                <option value="uptodown">Uptodown</option>
                <option value="apkcombo">APKCombo</option>
                <option value="mobilism">Mobilism</option>
                <option value="debug">Debug</option>
                <option value="other">Other</option>
            </select>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)} 
              className="w-full rounded-xl sm:rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-2.5 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all appearance-none"
            >
                <option value="name-asc">A-Z</option>
                <option value="name-desc">Z-A</option>
                <option value="install-date">Last Installed</option>
                <option value="source">By Store</option>
                <option value="unknown">Unknown First</option>
            </select>
            <button 
              onClick={checkAllUpdates} 
              disabled={isCheckingAll}
              className="w-full flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-samsung-blue px-4 py-2.5 sm:py-3 text-white hover:opacity-90 active:scale-95 transition-all text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(3,129,254,0.3)] disabled:opacity-50"
            >
                <RefreshCw size={16} className={isCheckingAll ? 'animate-spin' : ''} /> {isCheckingAll ? 'Checking...' : 'Check All'}
            </button>
            <button 
              onClick={copyUpdatesToClipboard}
              disabled={updatesAvailable === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-emerald-500 px-4 py-2.5 sm:py-3 text-white hover:opacity-90 active:scale-95 transition-all text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none"
            >
                <Copy size={16} /> Copy Updates
            </button>
            {isCheckingAll && (
              <div className="w-full mt-2 h-2 bg-samsung-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-samsung-blue transition-all duration-300" 
                  style={{ width: `${checkingProgress}%` }}
                />
              </div>
            )}
          </div>

          {updatesAvailable > 0 && (
            <div className="bg-amber-100/50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 p-4 rounded-3xl text-sm font-medium border border-amber-200/50 dark:border-amber-700/30 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available!
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-3.5">
              <label className="text-[9px] sm:text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] ml-2">GitHub Import</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <input type="text" placeholder="Owner" value={githubOwner} onChange={(e) => setGithubOwner(e.target.value)} className="w-full rounded-xl sm:rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-2 sm:py-3.5 px-4 sm:px-5 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all" />
                <div className="relative group">
                  <input type="text" placeholder="Repo" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full rounded-xl sm:rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-2 sm:py-3.5 pl-4 sm:pl-5 pr-10 sm:pr-12 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all" />
                  <button onClick={fetchLatestBeta} className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/20 transition-all active:scale-95 shadow-sm" title="Fetch Latest Beta">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <label className="text-[9px] sm:text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] ml-2">Inventory Management</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <button 
                  onClick={() => setShowManualAdd(!showManualAdd)} 
                  className={`flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold transition-all border shadow-sm active:scale-95 ${showManualAdd ? 'bg-samsung-blue text-white border-samsung-blue' : 'bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white border-transparent'}`}
                >
                  <Plus size={16} /> {showManualAdd ? 'Cancel' : 'Add App'}
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-samsung-blue text-white hover:opacity-90 transition-all text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(3,129,254,0.3)] active:scale-95 py-2.5 sm:py-3.5"
                >
                  <Upload size={16} /> Import
                </button>
                <button 
                  onClick={() => {
                    setInventory(prev => prev.map(app => ({
                      ...app,
                      category: app.category || guessCategory(app.packageName, app.name)
                    })));
                  }} 
                  className="flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-indigo-100 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/30 transition-all text-xs sm:text-sm font-bold border border-indigo-200/50 dark:border-indigo-700/30 shadow-sm active:scale-95"
                  title="Auto-categorize uncategorized apps"
                >
                  <Sparkles size={16} /> Auto-Sort
                </button>
                <button 
                  onClick={() => resolveAllUnknown()}
                  className="flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-bold hover:bg-amber-100 transition-all active:scale-95 border border-amber-200/50 dark:border-amber-700/30 shadow-sm"
                >
                  <Search size={16} /> Resolve
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json,.log,text/plain" className="hidden" />
              </div>
            </div>
          </div>

          {showManualAdd && (
            <div className="p-3.5 sm:p-6 bg-samsung-gray-50 dark:bg-white/5 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 animate-in zoom-in-95 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <input 
                  type="text" 
                  placeholder="App Name" 
                  value={newAppName} 
                  onChange={(e) => setNewAppName(e.target.value)} 
                  className="rounded-xl sm:rounded-2xl border-none bg-white dark:bg-white/10 py-2 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all" 
                />
                <input 
                  type="text" 
                  placeholder="Package Name (Optional)" 
                  value={newPackageName} 
                  onChange={(e) => setNewPackageName(e.target.value)} 
                  className="rounded-xl sm:rounded-2xl border-none bg-white dark:bg-white/10 py-2 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all" 
                />
                <input 
                  type="text" 
                  placeholder="Category (Optional)" 
                  value={newAppCategory} 
                  onChange={(e) => setNewAppCategory(e.target.value)} 
                  className="rounded-xl sm:rounded-2xl border-none bg-white dark:bg-white/10 py-2 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all" 
                />
                <input 
                  type="text" 
                  placeholder="Update URL" 
                  value={newAppUrl} 
                  onChange={(e) => setNewAppUrl(e.target.value)} 
                  className="rounded-xl sm:rounded-2xl border-none bg-white dark:bg-white/10 py-2 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all" 
                />
              </div>
              <div className="flex gap-2 sm:gap-3">
                <select 
                  value={newAppSource} 
                  onChange={(e) => setNewAppSource(e.target.value)} 
                  className="flex-1 rounded-xl sm:rounded-2xl border-none bg-white dark:bg-white/10 py-2 sm:py-3 px-4 text-xs sm:text-sm focus:ring-2 focus:ring-samsung-blue transition-all appearance-none"
                >
                  <option value="github">GitHub</option>
                  <option value="apkmirror">APKMirror</option>
                  <option value="apkpure">APKPure</option>
                  <option value="google-play">Play Store</option>
                  <option value="samsung-store">Samsung Store</option>
                  <option value="f-droid">F-Droid</option>
                  <option value="uptodown">Uptodown</option>
                  <option value="apkcombo">APKCombo</option>
                  <option value="mobilism">Mobilism</option>
                  <option value="neo-store">Neo Store</option>
                  <option value="aurora-store">Aurora Store</option>
                  <option value="unofficial-store">Unofficial Store</option>
                  <option value="debug">Debug</option>
                  <option value="other">Other</option>
                </select>
                <button 
                  onClick={() => { addApp(); setShowManualAdd(false); }} 
                  className="px-6 sm:px-10 rounded-xl sm:rounded-2xl bg-samsung-blue text-white text-xs sm:text-sm font-bold shadow-lg shadow-samsung-blue/20 active:scale-95 transition-all"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Export & Automation Section */}
          <div className="pt-4 sm:pt-6 border-t border-samsung-gray-100 dark:border-white/5">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[10px] sm:text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-200/30"
              >
                <FileText size={12} /> Excel
              </button>
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-bold hover:bg-blue-100 transition-all active:scale-95 border border-blue-200/30"
              >
                <FileText size={12} /> CSV
              </button>
              <button 
                onClick={exportToPDF}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] sm:text-xs font-bold hover:bg-rose-100 transition-all active:scale-95 border border-rose-200/30"
              >
                <FileText size={12} /> PDF
              </button>
              <button 
                onClick={shareInventory}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] sm:text-xs font-bold hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-200/30"
              >
                <Share2 size={12} /> Share
              </button>
              <button 
                onClick={copySummary}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-2xl bg-stone-50 dark:bg-white/10 text-stone-700 dark:text-stone-300 text-[10px] sm:text-xs font-bold hover:bg-stone-100 dark:hover:bg-white/20 transition-all active:scale-95 border border-stone-200/30"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        </section>

        {/* App List */}
        <section className="space-y-4" aria-label="App Inventory">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold">Your Apps</h2>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{filteredInventory.length} Items</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredInventory.length === 0 ? (
              <div className="lg:col-span-2 p-12 text-center space-y-4 bg-white dark:bg-samsung-gray-900 rounded-[3rem] border border-samsung-gray-100 dark:border-white/5">
                <div className="w-16 h-16 bg-samsung-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Smartphone className="text-stone-300" size={32} />
                </div>
                <p className="text-stone-400 text-sm">No apps tracked yet. Add one above or import a JSON file.</p>
              </div>
            ) : (
              filteredInventory.map((app) => (
                <article 
                  key={app.id} 
                  className={`glass rounded-3xl sm:rounded-[2.5rem] shadow-sm glow-blue-hover overflow-hidden transition-all duration-300 ${expandedAppIds.has(app.id) ? 'glow-border ring-2 ring-samsung-blue/20' : ''}`}
                >
                  <div 
                    className="flex items-center gap-3 sm:gap-4 p-3 sm:p-5 cursor-pointer hover:bg-samsung-gray-50/50 dark:hover:bg-white/5 transition-colors"
                    onClick={() => toggleExpand(app.id)}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-transform duration-300 ${expandedAppIds.has(app.id) ? 'scale-110' : ''} ${app.status === 'update-available' ? 'bg-amber-100 text-amber-600' : 'bg-samsung-gray-50 dark:bg-white/10 text-stone-500'}`}>
                        {app.iconUrl ? (
                          <img 
                            src={app.iconUrl} 
                            alt={app.name} 
                            className="w-full h-full object-cover rounded-xl sm:rounded-2xl" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          sourceIcons[app.source] || <Globe size={28} />
                        )}
                      </div>
                      {app.iconUrl && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-samsung-gray-800 shadow-sm flex items-center justify-center p-1 border border-samsung-gray-100 dark:border-white/10">
                          <div className="scale-[0.5] text-stone-500 dark:text-stone-400">
                            {sourceIcons[app.source] || <Globe size={12} />}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
                          {resolvingIds.has(app.id) ? (
                            <span className="text-stone-400 italic animate-pulse">Resolving...</span>
                          ) : (
                            app.name
                          )}
                        </h3>
                        {app.status === 'update-available' && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 group/pkg mt-1">
                        <p className="text-[10px] sm:text-xs text-stone-400 truncate font-mono opacity-80">{app.packageName}</p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(app.packageName); }}
                          className="opacity-0 group-hover/pkg:opacity-100 p-1 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 transition-all"
                          title="Copy Package Name"
                        >
                          <Copy size={12} />
                        </button>
                        {app.category && (
                          <span className="ml-2 px-2 py-0.5 rounded-md bg-samsung-gray-100 dark:bg-white/10 text-[9px] sm:text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                            {app.category}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-2.5 sm:mt-3" onClick={(e) => e.stopPropagation()}>
                        <a 
                          href={`https://play.google.com/store/apps/details?id=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="Google Play Store"
                        >
                          <Play size={14} />
                        </a>
                        <a 
                          href={`https://apps.samsung.com/appquery/appDetail.as?appId=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="Samsung Galaxy Store"
                        >
                          <ShoppingBag size={14} />
                        </a>
                        {app.updateUrl && (
                          <a 
                            href={app.updateUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-emerald-500 hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                            title="Direct Download"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        {app.source === 'github' && (
                          <a 
                            href={app.updateUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                            title="GitHub Repository"
                          >
                            <Github size={14} />
                          </a>
                        )}
                        <a 
                          href={`https://f-droid.org/en/packages/${app.packageName}/`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="F-Droid"
                        >
                          <Globe size={14} />
                        </a>
                        <a 
                          href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="APKMirror"
                        >
                          <Download size={14} />
                        </a>
                        <a 
                          href={`https://apkpure.com/search?q=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="APKPure"
                        >
                          <Share2 size={14} />
                        </a>
                        <a 
                          href={`https://en.aptoide.com/search?query=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="Aptoide"
                        >
                          <Box size={14} className="rotate-45" />
                        </a>
                        <a 
                          href={`https://app.mobilism.org/?q=${encodeURIComponent(app.name || app.packageName)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="Mobilism"
                        >
                          <Smartphone size={14} />
                        </a>
                        <a 
                          href={`https://www.uptodown.com/android/search/${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="Uptodown"
                        >
                          <Download size={14} className="scale-x-[-1]" />
                        </a>
                        <a 
                          href={`https://www.amazon.com/gp/mas/dl/android?p=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="Amazon Appstore"
                        >
                          <ShoppingBag size={14} className="opacity-70" />
                        </a>
                        <a 
                          href={`https://apkcombo.com/search/${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg bg-samsung-gray-50 dark:bg-white/5 text-stone-400 hover:text-samsung-blue hover:bg-samsung-gray-100 dark:hover:bg-white/10 transition-all active:scale-90"
                          title="APKCombo"
                        >
                          <Globe size={14} />
                        </a>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium" title={app.currentVersion}>
                        {formatVersion(app.currentVersion)}
                        {app.latestVersion && app.latestVersion !== app.currentVersion && app.latestVersion !== 'Latest (Store)' && (
                          <span className="text-samsung-blue ml-1" title={app.latestVersion}>→ {formatVersion(app.latestVersion)}</span>
                        )}
                      </div>
                      <div className="text-xs mt-1">
                        {app.status === 'checking' && <span className="text-stone-400 animate-pulse">Checking...</span>}
                        {app.status === 'up-to-date' && <span className="text-emerald-500 font-medium">Up to date</span>}
                        {app.status === 'update-available' && (
                          <span className="text-amber-500 font-bold">
                            {app.latestVersion === 'Latest (Store)' ? 'Check Store' : 'Update available'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedAppIds.has(app.id) && (
                    <div className="px-3.5 sm:px-5 pb-3.5 sm:pb-5 pt-0 space-y-3.5 sm:space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3.5 sm:p-5 bg-samsung-gray-50 dark:bg-white/5 rounded-2xl sm:rounded-3xl text-[10px] sm:text-xs">
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Clock size={12} /> Source Strategy</span>
                          <select 
                            value={app.source} 
                            onChange={(e) => updateAppSource(app.id, e.target.value)}
                            className="w-full bg-transparent border-none p-0 font-medium focus:ring-0 text-xs sm:text-sm"
                          >
                            <option value="github">GitHub</option>
                            <option value="apkmirror">APKMirror</option>
                            <option value="apkpure">APKPure</option>
                            <option value="google-play">Play Store</option>
                            <option value="samsung-store">Samsung Store</option>
                            <option value="f-droid">F-Droid</option>
                            <option value="mobilism">Mobilism</option>
                            <option value="neo-store">Neo Store</option>
                            <option value="aurora-store">Aurora Store</option>
                            <option value="unofficial-store">Unofficial Store</option>
                            <option value="debug">Debug</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Box size={12} /> Category</span>
                          <input 
                            type="text" 
                            value={app.category || ''} 
                            onChange={(e) => updateAppCategory(app.id, e.target.value)}
                            placeholder="e.g. Productivity"
                            className="w-full bg-transparent border-none p-0 font-medium focus:ring-0 placeholder:text-stone-500 text-xs sm:text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Smartphone size={12} /> Package Name</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate block text-xs sm:text-sm">{app.packageName}</span>
                            {(app.name === 'Unknown App' || isPackageName(app.name)) && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); resolvePackage(app.id, app.packageName); }}
                                className="p-1 rounded-md bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                                title="Resolve App Name"
                              >
                                <RefreshCw size={12} className={resolvingIds.has(app.id) ? 'animate-spin' : ''} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Calendar size={12} /> Installed</span>
                          <span className="font-medium truncate block text-xs sm:text-sm">{app.installationDate || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><RefreshCw size={12} /> Last Update</span>
                          <span className="font-medium truncate block text-xs sm:text-sm">{app.lastUpdateTime || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><ShieldCheck size={12} /> Min SDK</span>
                          <span className="font-medium text-xs sm:text-sm">{app.minSdk || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><ShieldCheck size={12} /> Target SDK</span>
                          <span className="font-medium text-xs sm:text-sm">{app.targetSdk || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><BarChart3 size={12} /> Version Code</span>
                          <span className="font-medium text-xs sm:text-sm">{app.versionCode || 'N/A'}</span>
                        </div>
                        {app.signature && (
                          <div className="space-y-1 sm:col-span-2">
                            <span className="text-stone-400 flex items-center gap-1"><ShieldCheck size={12} /> Signature</span>
                            <span className="font-medium truncate block opacity-60 text-xs sm:text-sm">{app.signature}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2.5 sm:gap-3">
                        {app.status === 'update-available' && app.updateUrl && (
                          <a 
                            href={app.updateUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-samsung-blue py-2.5 sm:py-3.5 text-white text-xs sm:text-sm font-bold shadow-lg shadow-samsung-blue/20 active:scale-95 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={16} /> {app.updateUrl.endsWith('.apk') || ['github', 'apkmirror', 'f-droid', 'mobilism'].includes(app.source) ? 'Download APK' : 'Download Update'}
                          </a>
                        )}
                        <a 
                          href={getStoreUrl(app) || '#'}
                          target={getStoreUrl(app) ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-samsung-gray-100 dark:bg-white/10 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold active:scale-95 transition-all ${!getStoreUrl(app) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={(e) => {
                            if (!getStoreUrl(app)) {
                              e.preventDefault();
                              return;
                            }
                            e.stopPropagation();
                          }}
                        >
                          <ExternalLink size={16} /> Store
                        </a>
                        <button 
                          onClick={(e) => { e.stopPropagation(); checkUpdate(app.id); }} 
                          className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/20 transition-all active:scale-95"
                        >
                          <RefreshCw size={18} className={app.status === 'checking' ? 'animate-spin' : ''} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setInventory(prev => prev.filter(a => a.id !== app.id)); }} 
                          className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-all active:scale-95"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pb-12 text-center space-y-6 sm:space-y-8 px-4">
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-white/50 dark:bg-white/5 rounded-2xl sm:rounded-[2.5rem] border border-samsung-gray-100 dark:border-white/5">
          <p className="text-[10px] sm:text-xs text-stone-400 leading-relaxed max-w-2xl mx-auto font-medium">
            Need help? Check out the <a href="https://github.com/RE3CON/Android-Update-Checker/wiki" target="_blank" rel="noopener noreferrer" className="text-samsung-blue hover:underline">Official Wiki</a> for guides on importing apps from App Manager and SD Maid SE.
          </p>
        </div>
        
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm font-bold text-stone-500">
            <a href="https://github.com/RE3CON/Android-Update-Checker" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-samsung-blue transition-all active:scale-95">
              <Github size={16} />
              <span>GitHub Repo</span>
            </a>
            <span className="opacity-20 hidden sm:inline">|</span>
            <a href="https://github.com/RE3CON/Android-Update-Checker/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-samsung-blue transition-all active:scale-95">
              <Scale size={16} />
              <span>License</span>
            </a>
          </div>
          <p className="text-stone-400 text-[10px] sm:text-xs uppercase tracking-[0.25em] font-black opacity-40">
            &copy; {new Date().getFullYear()} RE3CON • <a href="https://github.com/RE3CON/Android-Update-Checker" target="_blank" rel="noopener noreferrer" className="hover:text-samsung-blue transition-colors">Universal App Tracker v2.8</a>
          </p>
        </div>
      </footer>
      <Analytics />
    </div>
  );
}
