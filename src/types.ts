export interface AppItem {
  id: string;
  name: string;
  currentVersion: string;
  latestVersion?: string;
  updateUrl: string;
  source: 'apkmirror' | 'github' | 'artifacts' | 'google-play' | 'debug' | 'other' | 'f-droid' | 'neo-store' | 'aurora-store' | 'unofficial-store' | 'samsung-store';
  status: 'up-to-date' | 'update-available' | 'checking';
  packageName: string;
  installationDate?: string;
  lastUpdateTime?: string;
  minSdk?: string;
  targetSdk?: string;
  versionCode?: string;
  signature?: string;
  iconUrl?: string;
  category?: string;
}
