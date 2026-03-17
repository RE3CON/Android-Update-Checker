import React, { useState, useMemo, useRef, ChangeEvent } from 'react';
import { Plus, Trash2, ExternalLink, RefreshCw, Search, Upload, Github, Play, Smartphone, Download, ShoppingBag, Zap, Bug, Globe, Box } from 'lucide-react';
import { AppItem } from './types';
import { initialInventory } from './data';

const sourceIcons: Record<string, React.ReactNode> = {
  github: <Github size={16} />,
  'google-play': <Play size={16} />,
  'f-droid': <Smartphone size={16} />,
  apkmirror: <Download size={16} />,
  apkpure: <Download size={16} />,
  'samsung-store': <ShoppingBag size={16} />,
  'neo-store': <ShoppingBag size={16} />,
  'aurora-store': <Zap size={16} />,
  'unofficial-store': <Box size={16} />,
  debug: <Bug size={16} />,
  other: <Globe size={16} />,
};

export default function App() {
  const [inventory, setInventory] = useState<AppItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newAppSource, setNewAppSource] = useState('github');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedAppIds, setExpandedAppIds] = useState<Set<string>>(new Set());
  const [isScrolled, setIsScrolled] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

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
    return inventory.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            app.packageName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSource = filterSource === 'all' || app.source === filterSource;
      return matchesSearch && matchesSource;
    });
  }, [inventory, searchTerm, filterSource]);

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
      
      const { latestVersion, updateUrl } = await response.json();
      
      const status = latestVersion !== app.currentVersion ? 'update-available' : 'up-to-date';
      
      setInventory(prev => prev.map(a => a.id === id ? { ...a, status, latestVersion, updateUrl } : a));
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
        packageName: newAppName
    };
    setInventory(prev => [...prev, newApp]);
    setNewAppName('');
    setNewAppUrl('');
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

        const importedApps: AppItem[] = json.map((app: any, index: number) => ({
          id: app.packageName || app.name || `imported-${Date.now()}-${index}`,
          name: app.label || app.name || 'Unknown App',
          currentVersion: app.versionName || app.version || '0.0.0',
          updateUrl: app.updateUrl || '',
          source: app.source || 'other',
          status: 'up-to-date',
          packageName: app.packageName || app.name || 'unknown',
        }));
        
        setInventory(prev => {
          const existingPackages = new Set(prev.map(a => a.packageName));
          const newApps = importedApps.filter(a => !existingPackages.has(a.packageName));
          return [...prev, ...newApps];
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
    <div className="min-h-screen bg-samsung-gray-50 dark:bg-black p-4 sm:p-8 font-sans text-samsung-gray-900 dark:text-white transition-colors duration-300">
      {/* One UI 8 Header */}
      <header className={`sticky top-0 z-50 mb-8 transition-all duration-300 ${isScrolled ? 'bg-white/80 dark:bg-black/80 backdrop-blur-xl py-4 -mx-4 px-8 shadow-sm' : 'py-8'}`}>
        <div className="max-w-4xl mx-auto">
          <h1 className={`font-bold tracking-tight transition-all duration-300 ${isScrolled ? 'text-xl' : 'text-4xl mb-2'}`}>
            App Tracker
          </h1>
          {!isScrolled && (
            <p className="text-samsung-gray-800 dark:text-stone-400 text-lg opacity-70">
              Manage your application updates
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        {/* Quick Actions Card */}
        <section className="bg-white dark:bg-samsung-gray-900 rounded-4xl p-6 shadow-sm border border-samsung-gray-100 dark:border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
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
              className="rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3 px-4 text-sm focus:ring-2 focus:ring-samsung-blue transition-all"
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
            <button 
              onClick={checkAllUpdates} 
              className="flex items-center justify-center gap-2 rounded-2xl bg-samsung-blue px-6 py-3 text-white hover:opacity-90 active:scale-95 transition-all text-sm font-semibold shadow-lg shadow-samsung-blue/20"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-2">GitHub Import</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Owner" value={githubOwner} onChange={(e) => setGithubOwner(e.target.value)} className="flex-1 rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3 px-4 text-sm" />
                <input type="text" placeholder="Repo" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="flex-1 rounded-2xl border-none bg-samsung-gray-50 dark:bg-white/5 py-3 px-4 text-sm" />
                <button onClick={fetchLatestBeta} className="p-3 rounded-2xl bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white hover:bg-samsung-gray-200 dark:hover:bg-white/20 transition-all">
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-2">Actions</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowManualAdd(!showManualAdd)} 
                  className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all border ${showManualAdd ? 'bg-samsung-blue text-white border-samsung-blue' : 'bg-samsung-gray-100 dark:bg-white/10 text-samsung-gray-900 dark:text-white border-transparent'}`}
                >
                  <Plus size={18} /> {showManualAdd ? 'Cancel' : 'Add App'}
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-sky-100 dark:bg-sky-900/20 text-sky-900 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-900/30 transition-all text-sm font-semibold border border-sky-200/50 dark:border-sky-700/30"
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
                  placeholder="Update URL" 
                  value={newAppUrl} 
                  onChange={(e) => setNewAppUrl(e.target.value)} 
                  className="rounded-2xl border-none bg-white dark:bg-white/10 py-3 px-4 text-sm" 
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
        </section>

        {/* App List */}
        <section className="bg-white dark:bg-samsung-gray-900 rounded-4xl shadow-sm border border-samsung-gray-100 dark:border-white/5 overflow-hidden">
          {filteredInventory.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-samsung-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="text-stone-300" size={32} />
              </div>
              <p className="text-stone-400 text-sm">No apps tracked yet. Add one above or import a JSON file.</p>
            </div>
          ) : (
            <div className="divide-y divide-samsung-gray-100 dark:divide-white/5">
              {filteredInventory.map((app) => (
                <div key={app.id} className="transition-colors hover:bg-samsung-gray-50/50 dark:hover:bg-white/5">
                  <div 
                    className="flex items-center gap-4 p-5 cursor-pointer"
                    onClick={() => toggleExpand(app.id)}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${app.status === 'update-available' ? 'bg-amber-100 text-amber-600' : 'bg-samsung-gray-50 dark:bg-white/10 text-stone-500'}`}>
                      {sourceIcons[app.source] || <Globe size={24} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base truncate">{app.name}</h3>
                        {app.status === 'update-available' && (
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-stone-400 truncate font-mono">{app.packageName}</p>
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
                          <span className="text-stone-400 block">Source Strategy</span>
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
                            <option value="debug">Debug</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 block">Package Name</span>
                          <span className="font-medium truncate block">{app.packageName}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 block">Min SDK</span>
                          <span className="font-medium">{app.minSdk || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-stone-400 block">Target SDK</span>
                          <span className="font-medium">{app.targetSdk || 'N/A'}</span>
                        </div>
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
                        <button 
                          onClick={(e) => { e.stopPropagation(); checkUpdate(app.id); }} 
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-samsung-gray-100 dark:bg-white/10 py-3 text-sm font-semibold"
                        >
                          <RefreshCw size={16} /> Refresh
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
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* PWA Install Prompt (Simulated or simplified) */}
      <footer className="max-w-4xl mx-auto mt-12 pb-12 text-center">
        <p className="text-stone-400 text-xs">
          App Tracker v2.0 • One UI 8 Design
        </p>
      </footer>
    </div>
  );
}
