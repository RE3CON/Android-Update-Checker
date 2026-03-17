import React, { useState, useMemo, useRef, ChangeEvent } from 'react';
import { Plus, Trash2, ExternalLink, RefreshCw, Search, Upload, Github, Play, Smartphone, Download, ShoppingBag, Zap, Bug, Globe, Box, FileText, Share2, BarChart3, Clock, Calendar, ShieldCheck, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppItem } from './types';
import { initialInventory } from './data';

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
};

export default function App() {
  const [inventory, setInventory] = useState<AppItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newPackageName, setNewPackageName] = useState('');
  const [newAppSource, setNewAppSource] = useState('github');
  const [sortBy, setSortBy] = useState('name-asc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedAppIds, setExpandedAppIds] = useState<Set<string>>(new Set());
  const [isScrolled, setIsScrolled] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const isPackageName = (name: string) => {
    return name.includes('.') && !name.includes(' ');
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
      return matchesSearch && matchesSource;
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
  }, [inventory, searchTerm, filterSource, sortBy]);

  const checkUpdate = async (id: string) => {
    const app = inventory.find(a => a.id === id);
    if (!app) return;

    setInventory(prev => prev.map(a => a.id === id ? { ...a, status: 'checking' } : a));

    try {
      const response = await fetch(`/api/check-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: app.source, packageName: app.packageName, updateUrl: app.updateUrl, appName: app.name })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to check update: ${response.status} ${errorText}`);
      }
      
      const { latestVersion, updateUrl, appName: resolvedName, iconUrl } = await response.json();
      
      const status = latestVersion !== app.currentVersion ? 'update-available' : 'up-to-date';
      
      setInventory(prev => prev.map(a => a.id === id ? { 
        ...a, 
        status, 
        latestVersion, 
        updateUrl,
        iconUrl: iconUrl || a.iconUrl,
        name: (isPackageName(a.name) || a.name === 'Unknown App') && resolvedName && !isPackageName(resolvedName) ? resolvedName : a.name
      } : a));
    } catch (error) {
      console.error('Error checking update:', error);
      setInventory(prev => prev.map(a => a.id === id ? { ...a, status: 'up-to-date' } : a));
    }
  };

  const checkAllUpdates = async () => {
    for (const app of inventory) {
      await checkUpdate(app.id);
    }
  };

  // Automatically check for updates on load
  React.useEffect(() => {
    if (inventory.length > 0) {
      checkAllUpdates();
    }
  }, [inventory.length]);

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
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Universal App Tracker Inventory", 14, 15);
    
    const tableData = inventory.map(app => [
      app.name,
      app.packageName,
      app.currentVersion,
      app.source,
      app.status
    ]);
    
    autoTable(doc, {
      head: [['Name', 'Package', 'Version', 'Source', 'Status']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 255] }
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
      }
    } catch (error) {
      console.error(`Failed to resolve ${packageName}:`, error);
    } finally {
      setResolvingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const resolveAllUnknown = (apps?: AppItem[]) => {
    const list = apps || inventory;
    list.forEach(app => {
      const isUnknown = app.name === 'Unknown App' || isPackageName(app.name);
      if (isUnknown && !resolvingIds.has(app.id)) {
        resolvePackage(app.id, app.packageName);
      }
    });
  };

  // Resolve unknown apps on mount or when inventory changes significantly
  React.useEffect(() => {
    if (inventory.length > 0) {
      const unknownCount = inventory.filter(app => app.name === 'Unknown App' || isPackageName(app.name)).length;
      if (unknownCount > 0 && resolvingIds.size === 0) {
        resolveAllUnknown();
      }
    }
  }, [inventory.length]);

  const addApp = () => {
    if (!newAppName || !newAppUrl) {
        alert('Please enter name and URL');
        return;
    }
    const newApp: AppItem = {
        id: Date.now().toString(),
        name: newAppName,
        currentVersion: '1.0.0',
        updateUrl: newAppUrl,
        source: newAppSource as any,
        status: 'up-to-date',
        packageName: newPackageName || (isPackageName(newAppName) ? newAppName : newAppName.toLowerCase().replace(/[^a-z0-9]/g, '.'))
    };
    setInventory(prev => [...prev, newApp]);
    setNewAppName('');
    setNewAppUrl('');
    setNewPackageName('');
  };

  const fetchLatestBeta = async () => {
    try {
      const response = await fetch(`/api/github-latest-beta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const json = JSON.parse(content);
        console.log('Parsed JSON:', json);
        
        if (!Array.isArray(json)) {
          throw new Error('Imported JSON must be an array of apps.');
        }

        const importedApps: AppItem[] = json.map((app: any, index: number) => {
          const packageName = app.name || app.packageName || app.id || 'unknown';
          const displayName = app.label || (isPackageName(packageName) ? 'Unknown App' : packageName);
          
          const formatDate = (ts: any) => {
            if (!ts) return undefined;
            const num = Number(ts);
            if (isNaN(num) || num <= 0) return String(ts);
            return new Date(num).toLocaleDateString();
          };

          let source: any = 'other';
          const rawSource = (app.source || '').toLowerCase();
          const installerName = app.installerPackageName || '';
          const installerLabel = app.installerPackageLabel || '';
          const pkg = packageName.toLowerCase();

          if (rawSource.includes('play') || installerName === 'com.android.vending' || installerLabel.toLowerCase().includes('play store')) {
            source = 'google-play';
          } else if (rawSource.includes('galaxy') || installerName === 'com.sec.android.app.samsungapps' || installerLabel.toLowerCase().includes('galaxy store')) {
            source = 'samsung-store';
          } else if (rawSource.includes('f-droid') || installerName === 'org.fdroid.fdroid' || installerLabel.toLowerCase().includes('f-droid')) {
            source = 'f-droid';
          } else if (rawSource.includes('neo') || installerName === 'com.machiav3lli.fdroid' || installerLabel.toLowerCase().includes('neo store')) {
            source = 'neo-store';
          } else if (rawSource.includes('aurora') || installerName === 'com.aurora.store' || installerLabel.toLowerCase().includes('aurora store')) {
            source = 'aurora-store';
          } else if (rawSource.includes('apkmirror') || installerLabel.toLowerCase().includes('apkmirror')) {
            source = 'apkmirror';
          } else if (rawSource.includes('apkpure') || installerLabel.toLowerCase().includes('apkpure')) {
            source = 'apkpure';
          } else if (rawSource.includes('github') || pkg.includes('github')) {
            source = 'github';
          } else if (installerName === 'com.google.android.packageinstaller' || installerLabel.toLowerCase().includes('paketinstallation')) {
            source = 'apkmirror'; 
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
              updateUrl = `samsungapps://ProductDetail/${packageName}`;
            }
          }
          
          return {
            id: packageName || `imported-${Date.now()}-${index}`,
            name: displayName,
            currentVersion: app.versionName || app.version || '0.0.0',
            updateUrl: updateUrl,
            source: source,
            status: 'up-to-date',
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
        
        setInventory(prev => {
          const existingPackages = new Set(prev.map(a => a.packageName));
          const newApps = importedApps.filter(a => !existingPackages.has(a.packageName));
          const updatedInventory = [...prev, ...newApps];
          
          // Trigger resolution for new unknown apps
          setTimeout(() => resolveAllUnknown(newApps), 100);
          
          return updatedInventory;
        });
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Failed to parse JSON file. Check console for details.');
      }
    };
    reader.readAsText(file);
  };

  const updateAppSource = (id: string, newSource: string) => {
    setInventory(prev => prev.map(app => app.id === id ? { ...app, source: newSource as any } : app));
  };

  return (
    <div className="min-h-screen bg-samsung-gray-50 dark:bg-samsung-gray-950 p-2 sm:p-8 font-sans text-samsung-gray-900 dark:text-white transition-colors duration-500">
      {/* One UI 8.5 Header */}
      <header 
        className={`sticky top-0 z-50 transition-all duration-500 px-6 py-4 ${
          isScrolled 
            ? 'bg-white/80 dark:bg-samsung-gray-950/80 backdrop-blur-2xl shadow-lg shadow-black/5 border-b border-samsung-gray-100 dark:border-white/5 py-3' 
            : 'bg-samsung-gray-50 dark:bg-samsung-gray-950'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className={`font-bold tracking-tight transition-all duration-500 ${isScrolled ? 'text-xl' : 'text-3xl'}`}>
              Universal App Tracker
            </h1>
            {!isScrolled && (
              <p className="text-sm text-stone-400 font-medium mt-1">
                Version Checker for Android Apps
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
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
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Statistics">
          <div className="bg-white dark:bg-samsung-gray-900 p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-samsung-gray-100 dark:border-white/5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-samsung-blue/10 flex items-center justify-center shrink-0">
              <Smartphone className="text-samsung-blue" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Total Apps</div>
            </div>
          </div>
          <div className="bg-white dark:bg-samsung-gray-900 p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-samsung-gray-100 dark:border-white/5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <RefreshCw className="text-amber-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.updatesAvailable}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Updates</div>
            </div>
          </div>
          <div className="bg-white dark:bg-samsung-gray-900 p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-samsung-gray-100 dark:border-white/5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Zap className="text-emerald-500" size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{stats.mostCommonSource}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Top Source</div>
            </div>
          </div>
        </section>

        {/* Quick Actions Card */}
        <section className="bg-white dark:bg-samsung-gray-900 rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-8 shadow-sm border border-samsung-gray-100 dark:border-white/5 space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Search apps..." 
                className="w-full rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-samsung-blue transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              value={filterSource} 
              onChange={(e) => setFilterSource(e.target.value)} 
              className="w-full rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3 px-4 text-sm focus:ring-2 focus:ring-samsung-blue transition-all"
            >
                <option value="all">All Sources</option>
                <option value="github">GitHub</option>
                <option value="apkmirror">APKMirror</option>
                <option value="apkpure">APKPure</option>
                <option value="google-play">Play Store</option>
                <option value="samsung-store">Samsung Store</option>
                <option value="f-droid">F-Droid</option>
                <option value="debug">Debug</option>
                <option value="other">Other</option>
            </select>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)} 
              className="w-full rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3 px-4 text-sm focus:ring-2 focus:ring-samsung-blue transition-all"
            >
                <option value="name-asc">A-Z</option>
                <option value="name-desc">Z-A</option>
                <option value="install-date">Last Installed</option>
                <option value="source">By Store</option>
                <option value="unknown">Unknown First</option>
            </select>
            <button 
              onClick={checkAllUpdates} 
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-samsung-blue px-6 py-3 text-white hover:opacity-90 active:scale-95 transition-all text-sm font-semibold shadow-lg shadow-samsung-blue/20"
            >
                <RefreshCw size={18} /> Check All
            </button>
          </div>

          {updatesAvailable > 0 && (
            <div className="bg-amber-100/50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 p-4 rounded-3xl text-sm font-medium border border-amber-200/50 dark:border-amber-700/30 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available!
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] ml-2">GitHub Import</label>
              <div className="flex gap-3">
                <input type="text" placeholder="Owner" value={githubOwner} onChange={(e) => setGithubOwner(e.target.value)} className="flex-1 rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3.5 px-5 text-sm focus:ring-2 focus:ring-samsung-blue transition-all" />
                <input type="text" placeholder="Repo" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="flex-1 rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3.5 px-5 text-sm focus:ring-2 focus:ring-samsung-blue transition-all" />
                <button onClick={fetchLatestBeta} className="p-3.5 rounded-2xl bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/20 transition-all active:scale-95 shadow-sm">
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] ml-2">Inventory Management</label>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowManualAdd(!showManualAdd)} 
                  className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all border shadow-sm active:scale-95 ${showManualAdd ? 'bg-samsung-blue text-white border-samsung-blue' : 'bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white border-transparent'}`}
                >
                  <Plus size={18} /> {showManualAdd ? 'Cancel' : 'Add App'}
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-sky-100 dark:bg-sky-900/20 text-sky-900 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-900/30 transition-all text-sm font-bold border border-sky-200/50 dark:border-sky-700/30 shadow-sm active:scale-95"
                >
                  <Upload size={18} /> Import JSON
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
              </div>
            </div>
          </div>

          {showManualAdd && (
            <div className="p-5 bg-samsung-gray-50 dark:bg-white/5 rounded-3xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  type="text" 
                  placeholder="App Name" 
                  value={newAppName} 
                  onChange={(e) => setNewAppName(e.target.value)} 
                  className="rounded-2xl border-none bg-white dark:bg-white/10 py-3 px-4 text-sm" 
                />
                <input 
                  type="text" 
                  placeholder="Package Name (Optional)" 
                  value={newPackageName} 
                  onChange={(e) => setNewPackageName(e.target.value)} 
                  className="rounded-2xl border-none bg-white dark:bg-white/10 py-3 px-4 text-sm" 
                />
                <input 
                  type="text" 
                  placeholder="Update URL" 
                  value={newAppUrl} 
                  onChange={(e) => setNewAppUrl(e.target.value)} 
                  className="rounded-2xl border-none bg-white dark:bg-white/10 py-3 px-4 text-sm sm:col-span-2" 
                />
              </div>
              <div className="flex gap-3">
                <select 
                  value={newAppSource} 
                  onChange={(e) => setNewAppSource(e.target.value)} 
                  className="flex-1 rounded-2xl border-none bg-white dark:bg-white/10 py-3 px-4 text-sm"
                >
                  <option value="github">GitHub</option>
                  <option value="apkmirror">APKMirror</option>
                  <option value="apkpure">APKPure</option>
                  <option value="google-play">Play Store</option>
                  <option value="samsung-store">Samsung Store</option>
                  <option value="f-droid">F-Droid</option>
                  <option value="neo-store">Neo Store</option>
                  <option value="aurora-store">Aurora Store</option>
                  <option value="unofficial-store">Unofficial Store</option>
                  <option value="debug">Debug</option>
                  <option value="other">Other</option>
                </select>
                <button 
                  onClick={() => { addApp(); setShowManualAdd(false); }} 
                  className="px-8 rounded-2xl bg-samsung-blue text-white text-sm font-bold shadow-lg shadow-samsung-blue/20"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Export & Automation Section */}
          <div className="pt-6 border-t border-samsung-gray-100 dark:border-white/5">
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95"
              >
                <FileText size={14} /> Excel
              </button>
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition-all active:scale-95"
              >
                <FileText size={14} /> CSV
              </button>
              <button 
                onClick={exportToPDF}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-all active:scale-95"
              >
                <FileText size={14} /> PDF
              </button>
              <button 
                onClick={shareInventory}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-all active:scale-95"
              >
                <Share2 size={14} /> Share
              </button>
              <button 
                onClick={copySummary}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-stone-50 dark:bg-white/10 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 dark:hover:bg-white/20 transition-all active:scale-95"
              >
                <Copy size={14} /> Copy Summary
              </button>
              <button 
                onClick={() => resolveAllUnknown()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-all active:scale-95"
              >
                <Search size={14} /> Resolve Names
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
                  className={`bg-white dark:bg-samsung-gray-900 rounded-[2.5rem] shadow-sm border border-samsung-gray-100 dark:border-white/5 overflow-hidden transition-all duration-300 ${expandedAppIds.has(app.id) ? 'ring-2 ring-samsung-blue/20 shadow-md' : ''}`}
                >
                  <div 
                    className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-samsung-gray-50/50 dark:hover:bg-white/5 transition-colors"
                    onClick={() => toggleExpand(app.id)}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 ${expandedAppIds.has(app.id) ? 'scale-110' : ''} ${app.status === 'update-available' ? 'bg-amber-100 text-amber-600' : 'bg-samsung-gray-50 dark:bg-white/10 text-stone-500'}`}>
                        {app.iconUrl ? (
                          <img 
                            src={app.iconUrl} 
                            alt={app.name} 
                            className="w-full h-full object-cover rounded-xl" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          sourceIcons[app.source] || <Globe size={24} />
                        )}
                      </div>
                      {app.iconUrl && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-samsung-gray-800 shadow-sm flex items-center justify-center p-0.5 border border-samsung-gray-100 dark:border-white/10">
                          <div className="scale-[0.4] text-stone-500 dark:text-stone-400">
                            {sourceIcons[app.source] || <Globe size={10} />}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm leading-tight">
                          {resolvingIds.has(app.id) ? (
                            <span className="text-stone-400 italic animate-pulse">Resolving...</span>
                          ) : (
                            app.name
                          )}
                        </h3>
                        {app.status === 'update-available' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 group/pkg mt-0.5">
                        <p className="text-[10px] text-stone-400 truncate font-mono opacity-80">{app.packageName}</p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(app.packageName); }}
                          className="opacity-0 group-hover/pkg:opacity-100 p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 transition-all"
                          title="Copy Package Name"
                        >
                          <Copy size={10} />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <a 
                          href={`https://play.google.com/store/apps/details?id=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="Google Play Store"
                        >
                          <Play size={10} />
                        </a>
                        <a 
                          href={`https://apps.samsung.com/appquery/appDetail.as?appId=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="Samsung Galaxy Store"
                        >
                          <ShoppingBag size={10} />
                        </a>
                        {app.source === 'github' && (
                          <a 
                            href={app.updateUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                            title="GitHub Repository"
                          >
                            <Github size={10} />
                          </a>
                        )}
                        <a 
                          href={`https://f-droid.org/en/packages/${app.packageName}/`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="F-Droid"
                        >
                          <Box size={10} />
                        </a>
                        <a 
                          href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="APKMirror"
                        >
                          <Download size={10} />
                        </a>
                        <a 
                          href={`https://apkpure.com/search?q=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="APKPure"
                        >
                          <Share2 size={10} />
                        </a>
                        <a 
                          href={`https://en.aptoide.com/search?query=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="Aptoide"
                        >
                          <Box size={10} className="rotate-45" />
                        </a>
                        <a 
                          href={`https://www.uptodown.com/android/search/${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="Uptodown"
                        >
                          <Download size={10} className="scale-x-[-1]" />
                        </a>
                        <a 
                          href={`https://www.amazon.com/gp/mas/dl/android?p=${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="Amazon Appstore"
                        >
                          <ShoppingBag size={10} className="opacity-70" />
                        </a>
                        <a 
                          href={`https://apkcombo.com/search/${app.packageName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-0.5 rounded hover:bg-samsung-gray-100 dark:hover:bg-white/10 text-stone-400 hover:text-samsung-blue transition-colors"
                          title="APKCombo"
                        >
                          <Globe size={10} />
                        </a>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">
                        {app.currentVersion}
                        {app.latestVersion && app.latestVersion !== app.currentVersion && app.latestVersion !== 'Latest (Store)' && (
                          <span className="text-samsung-blue ml-1">→ {app.latestVersion}</span>
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
                    <div className="px-5 pb-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 gap-3 p-4 bg-samsung-gray-50 dark:bg-white/5 rounded-3xl text-xs">
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Clock size={10} /> Source Strategy</span>
                          <select 
                            value={app.source} 
                            onChange={(e) => updateAppSource(app.id, e.target.value)}
                            className="w-full bg-transparent border-none p-0 font-medium focus:ring-0"
                          >
                            <option value="github">GitHub</option>
                            <option value="apkmirror">APKMirror</option>
                            <option value="apkpure">APKPure</option>
                            <option value="google-play">Play Store</option>
                            <option value="samsung-store">Samsung Store</option>
                            <option value="f-droid">F-Droid</option>
                            <option value="neo-store">Neo Store</option>
                            <option value="aurora-store">Aurora Store</option>
                            <option value="unofficial-store">Unofficial Store</option>
                            <option value="debug">Debug</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Smartphone size={10} /> Package Name</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate block">{app.packageName}</span>
                            {(app.name === 'Unknown App' || isPackageName(app.name)) && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); resolvePackage(app.id, app.packageName); }}
                                className="p-1 rounded-md bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                                title="Resolve App Name"
                              >
                                <RefreshCw size={10} className={resolvingIds.has(app.id) ? 'animate-spin' : ''} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><Calendar size={10} /> Installed</span>
                          <span className="font-medium truncate block">{app.installationDate || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><RefreshCw size={10} /> Last Update</span>
                          <span className="font-medium truncate block">{app.lastUpdateTime || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><ShieldCheck size={10} /> Min SDK</span>
                          <span className="font-medium">{app.minSdk || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><ShieldCheck size={10} /> Target SDK</span>
                          <span className="font-medium">{app.targetSdk || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 flex items-center gap-1"><BarChart3 size={10} /> Version Code</span>
                          <span className="font-medium">{app.versionCode || 'N/A'}</span>
                        </div>
                        {app.signature && (
                          <div className="space-y-1 col-span-2">
                            <span className="text-stone-400 flex items-center gap-1"><ShieldCheck size={10} /> Signature</span>
                            <span className="font-medium truncate block opacity-60">{app.signature}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {app.status === 'update-available' && app.updateUrl && (
                          <a 
                            href={app.updateUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-samsung-blue py-3 text-white text-sm font-bold shadow-lg shadow-samsung-blue/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={16} /> Download Update
                          </a>
                        )}
                        <a 
                          href={app.source === 'google-play' ? `https://play.google.com/store/apps/details?id=${app.packageName}` : 
                                app.source === 'f-droid' ? `https://f-droid.org/en/packages/${app.packageName}/` :
                                app.source === 'samsung-store' ? `samsungapps://ProductDetail/${app.packageName}` :
                                app.updateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-samsung-gray-100 dark:bg-white/10 py-3 text-sm font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={16} /> Store
                        </a>
                        <button 
                          onClick={(e) => { e.stopPropagation(); checkUpdate(app.id); }} 
                          className="p-3 rounded-2xl bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/20 transition-all"
                        >
                          <RefreshCw size={18} className={app.status === 'checking' ? 'animate-spin' : ''} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setInventory(prev => prev.filter(a => a.id !== app.id)); }} 
                          className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all"
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

      <footer className="max-w-7xl mx-auto mt-12 pb-12 text-center space-y-4">
        <div className="px-6 py-4 bg-white/50 dark:bg-white/5 rounded-[2rem] border border-samsung-gray-100 dark:border-white/5">
          <p className="text-[10px] text-stone-400 leading-relaxed max-w-2xl mx-auto">
            How to use: Export your device inventory from <a href="https://github.com/MuntashirAkon/AppManager" target="_blank" rel="noopener noreferrer" className="text-samsung-blue hover:underline">App Manager</a> (Settings &gt; Backup &gt; Backup apps info JSON), then click "Import JSON" above to track your apps.
          </p>
        </div>
        <p className="text-stone-400 text-[10px] uppercase tracking-widest font-bold opacity-50">
          Universal App Tracker v2.5 • One UI 8 Design
        </p>
      </footer>
    </div>
  );
}
