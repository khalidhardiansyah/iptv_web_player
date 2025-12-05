export type ProviderType = 'stalker' | 'xtream' | 'm3u';

export interface SavedPortal {
  id: string;
  name: string;
  type: ProviderType;
  lastUsed?: number;
  
  // Stalker fields
  url?: string;
  mac?: string;
  
  // Xtream fields
  server?: string;
  username?: string;
  password?: string;
  
  // M3U fields
  playlistUrl?: string;
}
