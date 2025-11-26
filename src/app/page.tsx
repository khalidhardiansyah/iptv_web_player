'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, Plus, Trash2, Edit2, Play, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { BrowserStalkerClient } from '@/lib/browser-stalker';
import { XtreamClient } from '@/lib/xtream-client';
import { M3UClient } from '@/lib/m3u-client';

import { supabase } from '@/lib/supabase';
import clsx from 'clsx';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

type ProviderType = 'stalker' | 'xtream' | 'm3u';

interface SavedPortal {
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

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // State for Portal Management
  const [portals, setPortals] = useState<SavedPortal[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [providerType, setProviderType] = useState<ProviderType>('stalker');
  const [name, setName] = useState('');
  
  // Stalker fields
  const [url, setUrl] = useState('');
  const [mac, setMac] = useState('');
  
  // Xtream fields
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // M3U fields
  const [playlistUrl, setPlaylistUrl] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showXtreamPassword, setShowXtreamPassword] = useState(false);
  const [showM3UPassword, setShowM3UPassword] = useState(false);

  // Generate unique portal name based on provider type
  const generatePortalName = (providerType: ProviderType, baseUrl: string, username?: string): string => {
    try {
      const url = new URL(baseUrl);
      let baseName = url.hostname.replace(/^www\./, '');
      
      // Check if name already exists (excluding current editing portal)
      const existingNames = portals
        .filter(p => editingId ? p.id !== editingId : true)
        .map(p => p.name.toLowerCase());
      
      let finalName = baseName;
      
      // If duplicate exists, try adding username first
      if (existingNames.includes(finalName.toLowerCase()) && username) {
        finalName = `${baseName} (${username})`;
      }
      
      // If still duplicate, add number
      if (existingNames.includes(finalName.toLowerCase())) {
        let counter = 2;
        while (existingNames.includes(`${baseName} ${counter}`.toLowerCase())) {
          counter++;
        }
        finalName = `${baseName} ${counter}`;
      }
      
      return finalName;
    } catch {
      return providerType === 'm3u' ? 'M3U Playlist' : 'My IPTV Portal';
    }
  };

  const fetchPortals = async () => {
    try {
      const { data, error } = await supabase
        .from('portals')
        .select('*')
        .order('last_used', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedPortals: SavedPortal[] = data.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type as ProviderType,
          lastUsed: p.last_used,
          url: p.url,
          mac: p.mac,
          server: p.server,
          username: p.username,
          password: p.password,
          playlistUrl: p.playlist_url
        }));
        setPortals(mappedPortals);
        if (mappedPortals.length === 0) setView('form');
      }
    } catch (error) {
      console.error('Error fetching portals:', error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchPortals();
  }, []);

  // Auto-generate portal name when URL changes for Stalker
  useEffect(() => {
    if (providerType === 'stalker' && url && !editingId) {
      const generatedName = generatePortalName('stalker', url, mac);
      if (!name || name === generatedName) {
        setName(generatedName);
      }
    }
  }, [url, mac, providerType]);

  // Auto-generate portal name when server changes for Xtream
  useEffect(() => {
    if (providerType === 'xtream' && server && !editingId) {
      const generatedName = generatePortalName('xtream', server, username);
      if (!name || name === generatedName) {
        setName(generatedName);
      }
    }
  }, [server, username, providerType]);

  // Auto-generate portal name when playlist URL changes for M3U
  useEffect(() => {
    if (providerType === 'm3u' && playlistUrl && !editingId) {
      const generatedName = generatePortalName('m3u', playlistUrl, username);
      if (!name || name === generatedName) {
        setName(generatedName);
      }
    }
  }, [playlistUrl, username, providerType]);



  const handleConnect = async (portal: SavedPortal) => {
    setLoading(true);
    setError('');
    try {
      // Update last used in background
      supabase.from('portals').update({ last_used: Date.now() }).eq('id', portal.id).then(() => {
        fetchPortals(); // Refresh list to update order
      });

      // Verify connection based on provider type
      if (portal.type === 'stalker') {
        if (!portal.url || !portal.mac) throw new Error('Missing Stalker credentials');
        const client = new BrowserStalkerClient({ baseUrl: portal.url, mac: portal.mac });
        await client.handshake();
      } else if (portal.type === 'xtream') {
        if (!portal.server || !portal.username || !portal.password) throw new Error('Missing Xtream credentials');
        const client = new XtreamClient({ baseUrl: portal.server, username: portal.username, password: portal.password });
        await client.authenticate();
      } else if (portal.type === 'm3u') {
        if (!portal.playlistUrl) throw new Error('Missing M3U playlist URL');
        const client = new M3UClient({ playlistUrl: portal.playlistUrl, username: portal.username, password: portal.password });
        await client.authenticate();
      }
      
      router.push(`/player?id=${portal.id}`);
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(`Failed to connect to ${portal.name}: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let newPortal: SavedPortal;

      // Verify connection and create portal based on type
      if (providerType === 'stalker') {
        if (!url.startsWith('http')) {
          throw new Error('URL must start with http:// or https://');
        }
        const client = new BrowserStalkerClient({ baseUrl: url, mac });
        await client.handshake();
        
        newPortal = {
          id: editingId || crypto.randomUUID(),
          name: name || new URL(url).hostname,
          type: 'stalker',
          url,
          mac,
          lastUsed: Date.now()
        };
        
        localStorage.setItem('provider_type', 'stalker');
        localStorage.setItem('stalker_url', url);
        localStorage.setItem('stalker_mac', mac);
      } else if (providerType === 'xtream') {
        if (!server.startsWith('http')) {
          throw new Error('Server URL must start with http:// or https://');
        }
        const client = new XtreamClient({ baseUrl: server, username, password });
        await client.authenticate();
        
        newPortal = {
          id: editingId || crypto.randomUUID(),
          name: name || new URL(server).hostname,
          type: 'xtream',
          server,
          username,
          password,
          lastUsed: Date.now()
        };
        
        localStorage.setItem('provider_type', 'xtream');
        localStorage.setItem('xtream_server', server);
        localStorage.setItem('xtream_username', username);
        localStorage.setItem('xtream_password', password);
      } else { // m3u
        if (!playlistUrl.startsWith('http')) {
          throw new Error('Playlist URL must start with http:// or https://');
        }
        const client = new M3UClient({ playlistUrl, username, password });
        await client.authenticate();
        
        newPortal = {
          id: editingId || crypto.randomUUID(),
          name: name || 'M3U Playlist',
          type: 'm3u',
          playlistUrl,
          username: username || undefined,
          password: password || undefined,
          lastUsed: Date.now()
        };
        
        localStorage.setItem('provider_type', 'm3u');
        localStorage.setItem('m3u_playlist_url', playlistUrl);
        if (username) localStorage.setItem('m3u_username', username);
        if (password) localStorage.setItem('m3u_password', password);
      }

      // Save to Supabase
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

      if (upsertError) throw upsertError;

      await fetchPortals();

      
      router.push('/player');
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to verify portal connection');
      setLoading(false);
    }
  };

  const handleEdit = (portal: SavedPortal) => {
    setProviderType(portal.type);
    setName(portal.name);
    setEditingId(portal.id);
    
    // Load provider-specific fields
    if (portal.type === 'stalker') {
      setUrl(portal.url || '');
      setMac(portal.mac || '');
    } else if (portal.type === 'xtream') {
      setServer(portal.server || '');
      setUsername(portal.username || '');
      setPassword(portal.password || '');
    } else if (portal.type === 'm3u') {
      setPlaylistUrl(portal.playlistUrl || '');
      setUsername(portal.username || '');
      setPassword(portal.password || '');
    }
    
    setView('form');
    setError('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Delete clicked for portal:', id);
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      console.log('User confirmed deletion');
      try {
        const { error } = await supabase.from('portals').delete().eq('id', deleteConfirmId);
        if (error) throw error;
        
        await fetchPortals();
        console.log('Portal deleted successfully');
      } catch (error) {
        console.error('Error deleting portal:', error);
      }
    }
    setDeleteConfirmId(null);
  };

  const cancelDelete = () => {
    console.log('User cancelled deletion');
    setDeleteConfirmId(null);
  };

  const handleAddNew = () => {
    setProviderType('stalker');
    setName('');
    setUrl('');
    setMac('');
    setServer('');
    setUsername('');
    setPassword('');
    setPlaylistUrl('');
    setEditingId(null);
    setView('form');
    setError('');
    setShowXtreamPassword(false);
    setShowM3UPassword(false);
  };

  // Parse Xtream URL from get.php format
  const parseXtreamUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      const params = new URLSearchParams(url.search);
      
      const username = params.get('username');
      const password = params.get('password');
      
      if (username && password) {
        // Extract server URL (protocol + host + port)
        const serverUrl = `${url.protocol}//${url.host}`;
        
        setServer(serverUrl);
        setUsername(username);
        setPassword(password);
        setError('');
        console.log('Parsed Xtream URL:', { serverUrl, username, password });
      } else {
        setError('Invalid Xtream URL format. Missing username or password parameters.');
      }
    } catch (err) {
      setError('Invalid URL format. Please check and try again.');
    }
  };

  const handleXtreamUrlPaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const pastedUrl = e.target.value.trim();
    if (pastedUrl && pastedUrl.includes('get.php')) {
      parseXtreamUrl(pastedUrl);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black z-0 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-7xl">
        <div className="flex flex-col items-center mb-8 lg:mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
            <Tv className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Stalker Player
          </h1>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">Manage and connect to your IPTV portals</p>
        </div>

        {view === 'list' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {portals.map((portal) => (
                <div
                  key={portal.id}
                  onClick={() => handleConnect(portal)}
                  className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-8 hover:from-white/15 hover:to-white/10 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/30 min-h-[280px] flex flex-col"
                >
                  {/* Action Buttons */}
                  <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(portal); }}
                      className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur rounded-xl text-gray-300 hover:text-white transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(portal.id, e)}
                      className="p-2.5 bg-black/40 hover:bg-red-500/60 backdrop-blur rounded-xl text-gray-300 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Header */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                      <Tv className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl text-white truncate mb-2">{portal.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                          "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide",
                          portal.type === 'stalker' && "bg-blue-500/30 text-blue-300 border border-blue-500/50",
                          portal.type === 'xtream' && "bg-purple-500/30 text-purple-300 border border-purple-500/50",
                          portal.type === 'm3u' && "bg-green-500/30 text-green-300 border border-green-500/50"
                        )}>
                          {portal.type}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-green-400">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          Ready
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-3 text-sm">
                    {portal.type === 'stalker' && (
                      <>
                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-gray-400 font-medium">URL</span>
                          <span className="text-white truncate max-w-[180px] ml-2">{portal.url}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-gray-400 font-medium">MAC</span>
                          <span className="text-white font-mono text-xs">{portal.mac}</span>
                        </div>
                      </>
                    )}
                    {portal.type === 'xtream' && (
                      <>
                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-gray-400 font-medium">Server</span>
                          <span className="text-white truncate max-w-[180px] ml-2">{portal.server}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-gray-400 font-medium">Username</span>
                          <span className="text-white truncate max-w-[180px] ml-2">{portal.username}</span>
                        </div>
                      </>
                    )}
                    {portal.type === 'm3u' && (
                      <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                        <span className="text-gray-400 font-medium">Playlist</span>
                        <span className="text-white truncate max-w-[180px] ml-2">{portal.playlistUrl}</span>
                      </div>
                    )}
                  </div>

                  {/* Connect Indicator */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-400 group-hover:text-blue-400 transition-colors">
                      <Play className="w-4 h-4 fill-current" />
                      <span className="font-medium">Click to connect</span>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={handleAddNew}
                className="group bg-white/5 backdrop-blur-xl border-2 border-white/10 border-dashed rounded-3xl p-8 hover:bg-white/10 hover:border-blue-500/30 transition-all flex flex-col items-center justify-center gap-6 min-h-[280px]"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center group-hover:scale-110 transition-transform border border-blue-500/30">
                  <Plus className="w-10 h-10 text-gray-400 group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="text-center">
                  <span className="text-lg text-gray-400 group-hover:text-white font-semibold block transition-colors">Add New Portal</span>
                  <span className="text-xs text-gray-600 group-hover:text-gray-400 mt-1 block">Connect to your IPTV service</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6 sm:mb-8">
              {portals.length > 0 && (
                <button 
                  onClick={() => setView('list')}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-xl sm:text-2xl font-bold">{editingId ? 'Edit Portal' : 'Add New Portal'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Provider Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Provider Type</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-black/50 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setProviderType('stalker')}
                    className={clsx(
                      "py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      providerType === 'stalker'
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    Stalker
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderType('xtream')}
                    className={clsx(
                      "py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      providerType === 'xtream'
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    Xtream
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderType('m3u')}
                    className={clsx(
                      "py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      providerType === 'm3u'
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    M3U
                  </button>
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
                  {/* Quick Paste URL */}
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
                    {editingId ? 'Update Portal' : 'Connect & Save'}
                    <Play className="w-4 h-4 fill-current" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
      
      {/* Loading Overlay */}
      {loading && view === 'list' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-black/80 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-white font-medium">Connecting to portal...</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-red-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-red-500/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Delete Portal</h3>
                <p className="text-sm text-gray-400 mt-1">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">{portals.find(p => p.id === deleteConfirmId)?.name}</span>?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-medium transition-all shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
