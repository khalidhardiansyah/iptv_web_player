import { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff, Play } from 'lucide-react';
import clsx from 'clsx';
import { SavedPortal, ProviderType } from '@/types/portal';
import { BrowserStalkerClient } from '@/lib/browser-stalker';
import { XtreamClient } from '@/lib/xtream-client';
import { M3UClient } from '@/lib/m3u-client';
import { supabase } from '@/lib/supabase';

interface PortalFormProps {
  initialData?: SavedPortal | null;
  onSuccess: (portalId: string) => void;
  onCancel: () => void;
  existingPortals: SavedPortal[];
}

export default function PortalForm({ initialData, onSuccess, onCancel, existingPortals }: PortalFormProps) {
  const [providerType, setProviderType] = useState<ProviderType>(initialData?.type || 'stalker');
  const [name, setName] = useState(initialData?.name || '');
  
  // Stalker fields
  const [url, setUrl] = useState(initialData?.url || '');
  const [mac, setMac] = useState(initialData?.mac || '');
  
  // Xtream fields
  const [server, setServer] = useState(initialData?.server || '');
  const [username, setUsername] = useState(initialData?.username || '');
  const [password, setPassword] = useState(initialData?.password || '');
  
  // M3U fields
  const [playlistUrl, setPlaylistUrl] = useState(initialData?.playlistUrl || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showXtreamPassword, setShowXtreamPassword] = useState(false);
  const [showM3UPassword, setShowM3UPassword] = useState(false);

  // Auto-generate portal name logic
  const generatePortalName = (type: ProviderType, baseUrl: string, user?: string): string => {
    try {
      const urlObj = new URL(baseUrl);
      let baseName = urlObj.hostname.replace(/^www\./, '');
      
      const existingNames = existingPortals
        .filter(p => initialData ? p.id !== initialData.id : true)
        .map(p => p.name.toLowerCase());
      
      let finalName = baseName;
      
      if (existingNames.includes(finalName.toLowerCase()) && user) {
        finalName = `${baseName} (${user})`;
      }
      
      if (existingNames.includes(finalName.toLowerCase())) {
        let counter = 2;
        while (existingNames.includes(`${baseName} ${counter}`.toLowerCase())) {
          counter++;
        }
        finalName = `${baseName} ${counter}`;
      }
      
      return finalName;
    } catch {
      return type === 'm3u' ? 'M3U Playlist' : 'My IPTV Portal';
    }
  };

  // Effects for auto-generating names
  useEffect(() => {
    if (providerType === 'stalker' && url && !initialData) {
      const generatedName = generatePortalName('stalker', url, mac);
      if (!name || name === generatedName) setName(generatedName);
    }
  }, [url, mac, providerType]);

  useEffect(() => {
    if (providerType === 'xtream' && server && !initialData) {
      const generatedName = generatePortalName('xtream', server, username);
      if (!name || name === generatedName) setName(generatedName);
    }
  }, [server, username, providerType]);

  useEffect(() => {
    if (providerType === 'm3u' && playlistUrl && !initialData) {
      const generatedName = generatePortalName('m3u', playlistUrl, username);
      if (!name || name === generatedName) setName(generatedName);
    }
  }, [playlistUrl, username, providerType]);

  const handleXtreamUrlPaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const pastedUrl = e.target.value.trim();
    if (pastedUrl && pastedUrl.includes('get.php')) {
      try {
        const urlObj = new URL(pastedUrl);
        const params = new URLSearchParams(urlObj.search);
        
        const user = params.get('username');
        const pass = params.get('password');
        
        if (user && pass) {
          const serverUrl = `${urlObj.protocol}//${urlObj.host}`;
          setServer(serverUrl);
          setUsername(user);
          setPassword(pass);
          setError('');
        } else {
          setError('Invalid Xtream URL format. Missing username or password parameters.');
        }
      } catch (err) {
        setError('Invalid URL format. Please check and try again.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (loading) {
      console.log('Form already submitting, ignoring duplicate submit');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      let newPortal: SavedPortal;

      if (providerType === 'stalker') {
        if (!url.startsWith('http')) throw new Error('URL must start with http:// or https://');
        const client = new BrowserStalkerClient({ baseUrl: url, mac });
        await client.handshake();
        
        newPortal = {
          id: initialData?.id || crypto.randomUUID(),
          name: name || new URL(url).hostname,
          type: 'stalker',
          url,
          mac,
          lastUsed: Date.now()
        };
      } else if (providerType === 'xtream') {
        if (!server.startsWith('http')) throw new Error('Server URL must start with http:// or https://');
        console.log('Creating Xtream client and authenticating...');
        const client = new XtreamClient({ baseUrl: server, username, password });
        console.log('Xtream client created, calling authenticate()...');
        const authResult = await client.authenticate();
        console.log('Authenticate returned:', authResult ? 'success' : 'null');
        
        console.log('Xtream authentication successful, creating portal object...');
        newPortal = {
          id: initialData?.id || crypto.randomUUID(),
          name: name || new URL(server).hostname,
          type: 'xtream',
          server,
          username,
          password,
          lastUsed: Date.now()
        };
        console.log('Portal object created:', newPortal.id);
      } else {
        if (!playlistUrl.startsWith('http')) throw new Error('Playlist URL must start with http:// or https://');
        const client = new M3UClient({ playlistUrl, username, password });
        await client.authenticate();
        
        newPortal = {
          id: initialData?.id || crypto.randomUUID(),
          name: name || 'M3U Playlist',
          type: 'm3u',
          playlistUrl,
          username: username || undefined,
          password: password || undefined,
          lastUsed: Date.now()
        };
      }

      console.log('Saving portal to database...');
      const { error: upsertError } = await supabase.from('portals').upsert({
        id: newPortal.id,
        name: newPortal.name,
        type: newPortal.type,
        last_used: newPortal.lastUsed,
        url: newPortal.url,
        mac: newPortal.mac,
        server: newPortal.server,
        username: newPortal.username,
        password: newPortal.password,
        playlist_url: newPortal.playlistUrl
      });

      console.log('Database upsert result:', { error: upsertError });
      if (upsertError) throw upsertError;

      // Save to localStorage for immediate use if needed
      if (newPortal.type === 'stalker') {
        localStorage.setItem('provider_type', 'stalker');
        localStorage.setItem('stalker_url', newPortal.url || '');
        localStorage.setItem('stalker_mac', newPortal.mac || '');
      } else if (newPortal.type === 'xtream') {
        localStorage.setItem('provider_type', 'xtream');
        localStorage.setItem('xtream_server', newPortal.server || '');
        localStorage.setItem('xtream_username', newPortal.username || '');
        localStorage.setItem('xtream_password', newPortal.password || '');
      } else {
        localStorage.setItem('provider_type', 'm3u');
        localStorage.setItem('m3u_playlist_url', newPortal.playlistUrl || '');
        if (newPortal.username) localStorage.setItem('m3u_username', newPortal.username);
        if (newPortal.password) localStorage.setItem('m3u_password', newPortal.password);
      }

      console.log('Portal saved successfully, calling onSuccess with ID:', newPortal.id);
      onSuccess(newPortal.id);
    } catch (err: any) {
      console.error('Save error:', err);
      console.error('Error stack:', err.stack);
      setError(err.message || 'Failed to verify portal connection');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <button 
          onClick={onCancel}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold">{initialData ? 'Edit Portal' : 'Add New Portal'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Provider Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Provider Type</label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-black/50 rounded-xl">
            {(['stalker', 'xtream', 'm3u'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setProviderType(type)}
                className={clsx(
                  "py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize",
                  providerType === type
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Portal Name */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Portal Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Sports IPTV"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
          />
        </div>

        {/* Stalker Fields */}
        {providerType === 'stalker' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Portal URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://example.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">MAC Address</label>
              <input
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                placeholder="00:1A:79:XX:XX:XX"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                required
              />
            </div>
          </>
        )}

        {/* Xtream Fields */}
        {providerType === 'xtream' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">
                Quick Setup - Paste Xtream URL
              </label>
              <textarea
                onChange={handleXtreamUrlPaste}
                placeholder="Paste your full Xtream URL here (e.g., http://server.com/get.php?username=xxx&password=xxx&type=m3u_plus)"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 ml-1">
                💡 Paste your full Xtream URL and we'll auto-fill the fields below
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white/5 text-gray-500">OR ENTER MANUALLY</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Server URL</label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="http://server.com:port"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <input
                  type={showXtreamPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowXtreamPassword(!showXtreamPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  {showXtreamPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* M3U Fields */}
        {providerType === 'm3u' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Playlist URL</label>
              <input
                type="text"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="http://example.com/playlist.m3u"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Username (Optional)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Password (Optional)</label>
              <div className="relative">
                <input
                  type={showM3UPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowM3UPassword(!showM3UPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  {showM3UPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              {initialData ? 'Update Portal' : 'Connect & Save'}
              <Play className="w-4 h-4 fill-current" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
