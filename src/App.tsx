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
      alert('Failed to check for updates.');
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/github-latest-beta`, {
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
        const importedApps: AppItem[] = json.map((app: any) => ({
          id: app.name || app.packageName || 'unknown',
          name: app.label || app.name || 'Unknown App',
          currentVersion: app.versionName || '0.0.0',
          updateUrl: app.updateUrl || '',
          source: app.source || 'artifacts',
          status: 'up-to-date',
          packageName: app.name || app.packageName || 'unknown',
        }));
        setInventory(prev => [...prev, ...importedApps]);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Failed to parse JSON file. Check console for details.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-stone-100 p-4 sm:p-8 font-sans text-stone-900">
      <header className="mb-6 flex flex-col gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">App Version Tracker</h1>
        <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input 
                type="text" 
                placeholder="Search apps..." 
                className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-10 pr-4 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-xl border border-stone-200 bg-white py-2 px-3 text-sm">
                <option value="all">All Sources</option>
                <option value="github">GitHub</option>
                <option value="apkmirror">APKMirror</option>
                <option value="apkpure">APKPure</option>
                <option value="google-play">Google Play Store</option>
                <option value="samsung-store">Samsung Store</option>
                <option value="f-droid">F-Droid</option>
                <option value="neo-store">Neo Store</option>
                <option value="aurora-store">Aurora Store</option>
                <option value="unofficial-store">Unofficial Store</option>
                <option value="amazon-appstore">Amazon Appstore</option>
                <option value="huawei-appgallery">Huawei AppGallery</option>
                <option value="debug">Debug Build</option>
                <option value="other">Other</option>
            </select>
            <button onClick={checkAllUpdates} className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-white hover:bg-stone-800 text-sm whitespace-nowrap">
                <RefreshCw size={16} /> Check All
            </button>
        </div>
        {updatesAvailable > 0 && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-xl mb-4 text-sm font-medium border border-amber-200">
                {updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available!
            </div>
        )}
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap gap-2">
                <input type="text" placeholder="Owner" value={githubOwner} onChange={(e) => setGithubOwner(e.target.value)} className="flex-1 rounded-xl border border-stone-200 bg-white py-2 px-3 text-sm" />
                <input type="text" placeholder="Repo" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="flex-1 rounded-xl border border-stone-200 bg-white py-2 px-3 text-sm" />
                <button onClick={fetchLatestBeta} className="flex items-center gap-2 rounded-xl bg-stone-200 px-3 py-2 text-stone-900 hover:bg-stone-300 text-sm">
                    <RefreshCw size={16} /> Fetch
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                <input type="text" placeholder="App Name" value={newAppName} onChange={(e) => setNewAppName(e.target.value)} className="flex-1 rounded-xl border border-stone-200 bg-white py-2 px-3 text-sm" />
                <input type="text" placeholder="URL" value={newAppUrl} onChange={(e) => setNewAppUrl(e.target.value)} className="flex-1 rounded-xl border border-stone-200 bg-white py-2 px-3 text-sm" />
                <select value={newAppSource} onChange={(e) => setNewAppSource(e.target.value)} className="rounded-xl border border-stone-200 bg-white py-2 px-3 text-sm">
                    <option value="github">GitHub</option>
                    <option value="apkmirror">APKMirror</option>
                    <option value="apkpure">APKPure</option>
                    <option value="google-play">Google Play Store</option>
                    <option value="samsung-store">Samsung Store</option>
                    <option value="f-droid">F-Droid</option>
                    <option value="neo-store">Neo Store</option>
                    <option value="aurora-store">Aurora Store</option>
                    <option value="unofficial-store">Unofficial Store</option>
                    <option value="amazon-appstore">Amazon Appstore</option>
                    <option value="huawei-appgallery">Huawei AppGallery</option>
                    <option value="debug">Debug Build</option>
                    <option value="other">Other</option>
                </select>
                <button onClick={addApp} className="flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-white hover:bg-stone-800 text-sm">
                    <Plus size={16} /> Add
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-sky-100 px-3 py-2 text-sky-900 hover:bg-sky-200 border border-sky-200 text-sm">
                    <Upload size={16} /> Import
                </button>
            </div>
        </div>
      </header>

      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
        <div className="hidden sm:grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-4 border-b border-stone-200 pb-4 font-semibold text-stone-500 text-sm">
          <div>App Name</div>
          <div>Version</div>
          <div>Source</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {filteredInventory.map((app) => (
          <div key={app.id} className="border-b border-stone-100">
            <div 
              className={`grid grid-cols-1 sm:grid-cols-[2fr,1fr,1fr,1fr,auto] items-center gap-2 sm:gap-4 py-3 text-sm cursor-pointer ${app.status === 'update-available' ? 'bg-amber-50/50' : ''}`}
              onClick={() => toggleExpand(app.id)}
            >
              <div className="flex flex-col">
                <span className="font-medium text-base sm:text-sm">{app.name}</span>
                <span className="font-mono text-xs text-stone-500">{app.packageName}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
                  <span>{app.currentVersion}</span>
                  {app.latestVersion && app.latestVersion !== app.currentVersion && (
                      <span className="text-amber-600">→ {app.latestVersion}</span>
                  )}
              </div>
              <div className="text-xs sm:text-sm flex items-center gap-2">
                {sourceIcons[app.source] || <Globe size={16} />}
                <span className="capitalize">{app.source.replace(/-/g, ' ')}</span>
              </div>
              <div className="text-xs sm:text-sm">
                  {app.status === 'checking' && (
                      <span className="text-stone-500 flex items-center gap-1">
                          <RefreshCw size={12} className="animate-spin" /> Checking...
                      </span>
                  )}
                  {app.status === 'up-to-date' && <span className="text-emerald-600">Up to date</span>}
                  {app.status === 'update-available' && (
                      app.updateUrl ? (
                          <a href={app.updateUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-bold hover:underline">
                              Update to {app.latestVersion}!
                          </a>
                      ) : (
                          <span className="text-amber-600 font-bold">Update to {app.latestVersion} (No URL)</span>
                      )
                  )}
              </div>
              <div className="flex gap-2 justify-end sm:justify-start">
                <button onClick={(e) => { e.stopPropagation(); checkUpdate(app.id); }} className="p-2 text-stone-500 hover:text-stone-900">
                  <RefreshCw size={16} />
                </button>
                <a href={`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(app.name)}`} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-500 hover:text-stone-900" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={16} />
                </a>
                <button onClick={(e) => { e.stopPropagation(); setInventory(prev => prev.filter(a => a.id !== app.id)); }} className="p-2 text-red-500 hover:text-red-700">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {expandedAppIds.has(app.id) && (
              <div className="px-4 py-3 bg-stone-50 text-xs text-stone-600 grid grid-cols-2 gap-2">
                <div><span className="font-semibold">Installed:</span> {app.installationDate || 'N/A'}</div>
                <div><span className="font-semibold">Last Updated:</span> {app.lastUpdateTime || 'N/A'}</div>
                <div><span className="font-semibold">Min SDK:</span> {app.minSdk || 'N/A'}</div>
                <div><span className="font-semibold">Target SDK:</span> {app.targetSdk || 'N/A'}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
