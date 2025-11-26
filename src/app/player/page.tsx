'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut, Menu, Search, Tv, ChevronRight, Play, User, X, Film, ChevronLeft } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import clsx from 'clsx';
import { BrowserStalkerClient } from '@/lib/browser-stalker';
import { BrowserXtreamClient } from '@/lib/browser-xtream';
import { M3UClient } from '@/lib/m3u-client';
import { supabase } from '@/lib/supabase';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

interface Category {
  id: string;
  title: string;
  alias?: string;
}

interface Channel {
  id: string;
  number?: string;
  name: string;
  cmd?: string;
  logo?: string;
  stream_id?: number;
  url?: string;
}

type ProviderType = 'stalker' | 'xtream' | 'm3u';
type ContentType = 'live' | 'vod' | 'series';

function PlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalId = searchParams.get('id');
  const [mounted, setMounted] = useState(false);
  const [providerType, setProviderType] = useState<ProviderType>('stalker');
  const [config, setConfig] = useState<any>(null);
  const clientRef = useRef<any>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [categoryHeight, setCategoryHeight] = useState(33); // Percentage height for categories section
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalChannels, setTotalChannels] = useState(0);
  const CHANNELS_PER_PAGE = 100;
  
  // Content type state
  const [contentType, setContentType] = useState<ContentType>('live');
  const [vodCategories, setVodCategories] = useState<Category[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<Category[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  
  // Mobile bottom sheet state
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetView, setBottomSheetView] = useState<'categories' | 'channels'>('categories');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const initPlayer = async () => {
      let type: ProviderType = 'stalker';
      let currentConfig: any = {};

      if (portalId) {
        try {
          const { data, error } = await supabase
            .from('portals')
            .select('*')
            .eq('id', portalId)
            .single();

          if (error || !data) {
            console.error('Portal not found or error:', error);
            router.push('/');
            return;
          }

          type = data.type as ProviderType;
          if (type === 'stalker') {
            currentConfig = { url: data.url, mac: data.mac };
          } else if (type === 'xtream') {
            currentConfig = { server: data.server, username: data.username, password: data.password };
          } else if (type === 'm3u') {
            currentConfig = { playlistUrl: data.playlist_url, username: data.username, password: data.password };
          }
        } catch (err) {
          console.error('Error fetching portal:', err);
          router.push('/');
          return;
        }
      } else {
        // Fallback to localStorage
        type = (localStorage.getItem('provider_type') || 'stalker') as ProviderType;
        if (type === 'stalker') {
          currentConfig = {
            url: localStorage.getItem('stalker_url'),
            mac: localStorage.getItem('stalker_mac')
          };
        } else if (type === 'xtream') {
          currentConfig = {
            server: localStorage.getItem('xtream_server'),
            username: localStorage.getItem('xtream_username'),
            password: localStorage.getItem('xtream_password')
          };
        } else if (type === 'm3u') {
          currentConfig = {
            playlistUrl: localStorage.getItem('m3u_playlist_url'),
            username: localStorage.getItem('m3u_username'),
            password: localStorage.getItem('m3u_password')
          };
        }
      }

      setProviderType(type);
      setConfig(currentConfig);

      // Initialize client based on provider type
      if (type === 'stalker') {
        if (!currentConfig.url || !currentConfig.mac) {
          router.push('/');
          return;
        }
        const client = new BrowserStalkerClient({ baseUrl: currentConfig.url, mac: currentConfig.mac });
        clientRef.current = client;
        fetchCategories(client);
      } else if (type === 'xtream') {
        if (!currentConfig.server || !currentConfig.username || !currentConfig.password) {
          router.push('/');
          return;
        }
        const client = new BrowserXtreamClient({ baseUrl: currentConfig.server, username: currentConfig.username, password: currentConfig.password });
        clientRef.current = client;
        fetchCategories(client);
      } else if (type === 'm3u') {
        if (!currentConfig.playlistUrl) {
          router.push('/');
          return;
        }
        const client = new M3UClient({ playlistUrl: currentConfig.playlistUrl, username: currentConfig.username, password: currentConfig.password });
        clientRef.current = client;
        fetchCategories(client);
      }
    };

    initPlayer();
  }, [mounted, portalId]);

  const fetchCategories = async (client: any) => {
    setLoadingCategories(true);
    try {
      // Authenticate based on client type (check if handshake method exists)
      if (typeof client.handshake === 'function') {
        await client.handshake();

      } else if (typeof client.authenticate === 'function') {
        await client.authenticate();

      }
      
      // Fetch account profile
      try {
        const profile = await client.getProfile();

        setAccountInfo(profile);
      } catch (profileError) {
        console.error('Failed to fetch profile:', profileError);
      }
      
      const cats = await client.getCategories();


      
      // Normalize category data for different providers
      const normalizedCategories = cats?.map((cat: any) => ({
        id: cat.id || cat.category_id?.toString() || '',
        title: cat.title || cat.category_name || 'Unknown',
        alias: cat.alias || ''
      })) || [];
      
      // Add "All Channels" as first category for Stalker
      if (typeof client.getAllChannels === 'function') {
        normalizedCategories.unshift({
          id: '__ALL__',
          title: '📺 All Channels',
          alias: 'all'
        });
      }
      
      setCategories(normalizedCategories);
      if (!normalizedCategories || normalizedCategories.length === 0) {
        console.warn('No categories returned from provider');
      }
    } catch (error) {
      console.error('Failed to fetch categories', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchVODCategories = async (client: any) => {
    if (typeof client.getVODCategories !== 'function') return;
    
    setLoadingCategories(true);
    try {
      const cats = await client.getVODCategories();
      const normalizedCategories = cats?.map((cat: any) => ({
        id: cat.id || cat.category_id?.toString() || '',
        title: cat.title || cat.category_name || 'Unknown',
        alias: cat.alias || ''
      })) || [];
      
      setVodCategories(normalizedCategories);

    } catch (error) {
      console.error('Failed to fetch VOD categories', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchSeriesCategories = async (client: any) => {
    if (typeof client.getSeriesCategories !== 'function') return;
    
    setLoadingCategories(true);
    try {
      const cats = await client.getSeriesCategories();
      const normalizedCategories = cats?.map((cat: any) => ({
        id: cat.id || cat.category_id?.toString() || '',
        title: cat.title || cat.category_name || 'Unknown',
        alias: cat.alias || ''
      })) || [];
      
      setSeriesCategories(normalizedCategories);

    } catch (error) {
      console.error('Failed to fetch Series categories', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleContentTypeChange = (type: ContentType) => {
    setContentType(type);
    setSelectedCategory(null);
    setChannels([]);
    setSelectedChannel(null);
    setStreamUrl(null);
    
    // Fetch appropriate categories if not already loaded
    if (type === 'vod' && vodCategories.length === 0) {
      fetchVODCategories(clientRef.current);
    } else if (type === 'series' && seriesCategories.length === 0) {
      fetchSeriesCategories(clientRef.current);
    }
  };


  const handleCategorySelect = async (categoryId: string) => {
    if (!clientRef.current) return;
    setSelectedCategory(categoryId);
    setLoadingChannels(true);
    setChannels([]);
    setCurrentPage(1);
    try {
      let chs = [];
      
      // Fetch based on content type
      if (contentType === 'live') {
        // Check if this is "All Channels" category
        if (categoryId === '__ALL__' && typeof clientRef.current.getAllChannels === 'function') {

          chs = await clientRef.current.getAllChannels();
          setTotalChannels(chs.length);

          // Only show first page
          chs = chs.slice(0, CHANNELS_PER_PAGE);
        } else {
          chs = await clientRef.current.getChannels(categoryId);
          setTotalChannels(chs.length);
        }
      } else if (contentType === 'vod') {
        chs = await clientRef.current.getVODItems(categoryId);
        setTotalChannels(chs.length);
      } else if (contentType === 'series') {
        chs = await clientRef.current.getSeriesItems(categoryId);
        setTotalChannels(chs.length);
      }
      
      // Normalize channel data for different providers
      const normalizedChannels = chs?.map((ch: any, index: number) => ({
        id: ch.id || ch.stream_id?.toString() || `ch_${index}`,
        number: ch.num?.toString() || ch.number || (index + 1).toString(),
        name: ch.name || ch.title,
        cmd: ch.cmd,
        logo: ch.stream_icon || ch.logo || ch.screenshot,
        stream_id: ch.stream_id,
        url: ch.url,
      })) || [];
      setChannels(normalizedChannels);

    } catch (error) {
      console.error('Failed to fetch channels', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!clientRef.current || !selectedCategory) return;
    setLoadingChannels(true);
    try {
      if (selectedCategory === '__ALL__' && typeof clientRef.current.getAllChannels === 'function') {
        const allChs = await clientRef.current.getAllChannels();
        const start = (newPage - 1) * CHANNELS_PER_PAGE;
        const end = start + CHANNELS_PER_PAGE;
        const pageChs = allChs.slice(start, end);
        
        const normalizedChannels = pageChs?.map((ch: any, index: number) => ({
          id: ch.id || ch.stream_id?.toString() || `ch_${index}`,
          number: ch.num?.toString() || ch.number || (start + index + 1).toString(),
          name: ch.name,
          cmd: ch.cmd,
          logo: ch.stream_icon || ch.logo,
          stream_id: ch.stream_id,
          url: ch.url,
        })) || [];
        
        setChannels(normalizedChannels);
        setCurrentPage(newPage);
      }
    } catch (error) {
      console.error('Failed to change page', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleChannelSelect = async (channel: Channel) => {

    if (!clientRef.current) return;
    setSelectedChannel(channel);
    setLoadingLink(true);
    setStreamUrl(null);
    try {

      
      let url: string;
      
      // Get stream URL based on provider type and content type
      if (providerType === 'stalker') {
        const cmd = channel.cmd || channel.id;

        
        if (contentType === 'vod') {
          url = await clientRef.current.getVODLink(cmd);
        } else if (contentType === 'series') {
          // For series, we need to show season/episode selection first
          // For now, just get the link (will enhance later)
          url = await clientRef.current.getSeriesLink(cmd, channel.id);
        } else {
          url = await clientRef.current.getLink(cmd);
        }
      } else if (providerType === 'xtream') {
        const streamId = channel.stream_id?.toString() || channel.id;

        url = await clientRef.current.getLink(streamId);
      } else { // m3u

        url = await clientRef.current.getLink(channel.id);
      }
      

      
      if (url) {
        // Only apply Stalker-specific URL fixes for Stalker provider
        if (providerType === 'stalker') {
          // Remove ffrt or ffmpeg prefix if present
          if (url.startsWith('ffrt ')) {
              url = url.substring(5);

          } else if (url.startsWith('ffmpeg ')) {
              url = url.substring(7);

          }

          // Fix malformed recursive URLs
          if (url.includes('stream=') && url.match(/stream=[^\&]*\/play\/live\.php/)) {

          }

          // Fix empty stream parameter
          if (url.includes('stream=&') || url.includes('stream=&')) {

              let streamId = '';
              const cmd = channel.cmd || '';
              if (cmd) {
                  const matchId = cmd.match(/\/([0-9]+)$/) || cmd.match(/^([0-9]+)$/);
                  const matchStream = cmd.match(/stream=([0-9]+)/);
                  
                  if (matchStream) {
                      streamId = matchStream[1];
                  } else if (matchId) {
                      streamId = matchId[1];
                  }
              }
              
              if (streamId) {
                  url = url.replace('stream=&', `stream=${streamId}&`);

              } else {
                  console.warn('Could not extract stream ID from cmd to fix empty stream parameter');
              }
          }
        }
        

        setStreamUrl(url);
      } else {
        console.error('No stream URL received from provider');
      }
    } catch (error) {
      console.error('Failed to get link', error);
    } finally {
      setLoadingLink(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stalker_url');
    localStorage.removeItem('stalker_mac');
    router.push('/');
  };

  // Drag handlers for resizable divider
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const sidebar = document.querySelector('.sidebar-container') as HTMLElement;
      if (!sidebar) return;

      const sidebarRect = sidebar.getBoundingClientRect();
      const sidebarHeight = sidebarRect.height;
      
      // Calculate mouse position relative to sidebar (excluding header)
      const headerHeight = 180; // Approximate header + account info height
      const availableHeight = sidebarHeight - headerHeight;
      const mouseY = e.clientY - sidebarRect.top - headerHeight;
      
      // Calculate new height as percentage
      let newHeight = (mouseY / availableHeight) * 100;
      
      // Enforce min/max constraints
      newHeight = Math.max(20, Math.min(80, newHeight));
      
      setCategoryHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  


  if (!mounted || !config) return null;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className={clsx(
        "sidebar-container flex-col border-r border-white/10 bg-zinc-950 transition-all duration-300 ease-in-out z-20",
        "hidden md:flex", // Hide on mobile, show on desktop
        sidebarOpen ? "w-80" : "w-0 opacity-0 overflow-hidden"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">IPTV Player</h1>
              <p className="text-xs text-gray-500">{config?.url}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Account Info */}
        {accountInfo && (
          <div className="p-4 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-b border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white truncate">
                  {accountInfo.name || accountInfo.full_name || 'Account'}
                </h3>
                <div className="mt-1 space-y-1">
                  {accountInfo.status && (
                    <p className="text-sm text-gray-400">
                      Status: <span className={accountInfo.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                        {accountInfo.status}
                      </span>
                    </p>
                  )}
                  {accountInfo.expire_date && (
                    <p className="text-sm text-gray-400">
                      Expire: <span className="text-white">{new Date(accountInfo.expire_date * 1000).toLocaleDateString()}</span>
                    </p>
                  )}
                  {accountInfo.account_balance !== undefined && (
                    <p className="text-sm text-gray-400">
                      Balance: <span className="text-white">{accountInfo.account_balance}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Content Type Tabs */}
          {providerType === 'stalker' && (
            <div className="flex border-b border-white/10 bg-zinc-950">
              <button
                onClick={() => handleContentTypeChange('live')}
                className={clsx(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  contentType === 'live'
                    ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                📺 Live TV
              </button>
              <button
                onClick={() => handleContentTypeChange('vod')}
                className={clsx(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  contentType === 'vod'
                    ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                🎬 Movies
              </button>
              <button
                onClick={() => handleContentTypeChange('series')}
                className={clsx(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  contentType === 'series'
                    ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                📺 Series
              </button>
            </div>
          )}
          
          {/* Categories */}
          <div className="border-b border-white/10 flex flex-col" style={{ height: `${categoryHeight}%` }}>
            <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-zinc-950 sticky top-0">
              Categories
            </div>
            <div className="p-3 border-b border-white/10 bg-zinc-950">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search categories..." 
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
              {loadingCategories ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
              ) : (
                (contentType === 'live' ? categories : contentType === 'vod' ? vodCategories : seriesCategories)
                  .filter(cat => cat.title.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                  .map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={clsx(
                        "w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between group",
                        selectedCategory === cat.id 
                          ? "bg-blue-600/10 text-blue-400 border-r-2 border-blue-500" 
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="truncate">{cat.title}</span>
                      <ChevronRight className={clsx("w-3 h-3 transition-transform", selectedCategory === cat.id ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Resizable Divider */}
          <div
            onMouseDown={handleDividerMouseDown}
            className={clsx(
              "h-1 bg-white/5 hover:bg-blue-500/30 cursor-ns-resize flex items-center justify-center group relative",
              isDragging && "bg-blue-500/50"
            )}
          >
            <div className="absolute inset-0 hover:bg-blue-500/20 transition-colors" />
            <div className="relative z-10 flex gap-0.5 py-0.5">
              <div className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors" />
              <div className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors" />
              <div className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors" />
            </div>
          </div>

          {/* Channels */}
          <div className="flex-1 flex flex-col min-h-0">
             <div className="p-3 border-b border-white/10 bg-zinc-950 sticky top-0 z-10">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                 <input 
                    type="text" 
                    placeholder="Search channels..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                 />
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                {loadingChannels ? (
                  <div className="p-8 text-center text-gray-500 text-sm animate-pulse">Loading channels...</div>
                ) : selectedCategory ? (
                  filteredChannels.length > 0 ? (
                    filteredChannels.map(channel => (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelSelect(channel)}
                        className={clsx(
                          "w-full text-left px-4 py-3 text-sm transition-all flex items-center gap-3 group border-b border-white/5",
                          selectedChannel?.id === channel.id
                            ? "bg-purple-600/20 text-purple-300" 
                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="w-8 h-8 bg-zinc-900 rounded flex items-center justify-center text-xs font-mono text-gray-600 shrink-0">
                           {channel.number}
                        </div>
                        <span className="truncate flex-1">{channel.name}</span>
                        {selectedChannel?.id === channel.id && <Play className="w-3 h-3 fill-current" />}
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-600 text-sm">No channels found</div>
                  )
                ) : (
                  <div className="p-8 text-center text-gray-600 text-sm">Select a category</div>
                )}
             </div>
             
             {/* Pagination for All Channels */}
             {selectedCategory === '__ALL__' && totalChannels > CHANNELS_PER_PAGE && (
               <div className="p-3 border-t border-white/10 bg-zinc-950 flex items-center justify-between text-xs">
                 <div className="text-gray-500">
                   Showing {((currentPage - 1) * CHANNELS_PER_PAGE) + 1}-{Math.min(currentPage * CHANNELS_PER_PAGE, totalChannels)} of {totalChannels.toLocaleString()} channels
                 </div>
                 <div className="flex gap-1">
                   <button
                     onClick={() => handlePageChange(currentPage - 1)}
                     disabled={currentPage === 1}
                     className={clsx(
                       "px-3 py-1 rounded transition-colors",
                       currentPage === 1 
                         ? "bg-zinc-800 text-gray-600 cursor-not-allowed" 
                         : "bg-zinc-800 text-white hover:bg-zinc-700"
                     )}
                   >
                     Prev
                   </button>
                   <div className="px-3 py-1 bg-blue-600 text-white rounded">
                     {currentPage} / {Math.ceil(totalChannels / CHANNELS_PER_PAGE)}
                   </div>
                   <button
                     onClick={() => handlePageChange(currentPage + 1)}
                     disabled={currentPage >= Math.ceil(totalChannels / CHANNELS_PER_PAGE)}
                     className={clsx(
                       "px-3 py-1 rounded transition-colors",
                       currentPage >= Math.ceil(totalChannels / CHANNELS_PER_PAGE)
                         ? "bg-zinc-800 text-gray-600 cursor-not-allowed" 
                         : "bg-zinc-800 text-white hover:bg-zinc-700"
                     )}
                   >
                     Next
                   </button>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-black">
        {/* Header */}
        <div className="absolute top-0 left-0 w-full p-4 z-10 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4 pointer-events-none">
           <button 
             onClick={() => setSidebarOpen(!sidebarOpen)}
             className="pointer-events-auto p-2 bg-black/50 backdrop-blur rounded-lg text-white hover:bg-white/20 transition-colors hidden md:block"
           >
             <Menu className="w-5 h-5" />
           </button>
           {selectedChannel && (
             <div className="flex flex-col">
               <h2 className="text-lg font-bold text-white drop-shadow-md">{selectedChannel.name}</h2>
               <span className="text-xs text-gray-300 drop-shadow">{categories.find(c => c.id === selectedCategory)?.title}</span>
             </div>
           )}
        </div>

        {/* Player */}
        <div className="flex-1 relative">
           <VideoPlayer src={streamUrl} />
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => setShowBottomSheet(true)}
        className="md:hidden fixed bottom-4 left-4 z-40 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-2xl active:scale-95 transition-transform flex items-center gap-2"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
        <span className="text-sm font-medium pr-1">Menu</span>
      </button>

      {/* Mobile Bottom Sheet */}
      {showBottomSheet && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBottomSheet(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up shadow-2xl border-t border-white/10">
            {/* Handle */}
            <div className="flex justify-center py-3" onClick={() => setShowBottomSheet(false)}>
              <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-white/10">
              <h2 className="text-xl font-bold">
                {bottomSheetView === 'categories' ? 'Categories' : 'Channels'}
              </h2>
              <button
                onClick={() => setShowBottomSheet(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Fixed Search Bar */}
            <div className="px-4 py-2 border-b border-white/10 bg-zinc-900 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder={bottomSheetView === 'categories' ? "Search categories..." : "Search channels..."}
                  value={bottomSheetView === 'categories' ? categorySearchQuery : searchQuery}
                  onChange={(e) => bottomSheetView === 'categories' ? setCategorySearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Content Type Tabs (for Stalker) */}
            {providerType === 'stalker' && bottomSheetView === 'categories' && (
              <div className="flex border-b border-white/10 px-4 pt-4">
                <button
                  onClick={() => handleContentTypeChange('live')}
                  className={clsx(
                    "flex-1 px-2 py-3 text-sm font-medium transition-colors rounded-t-lg flex flex-col items-center gap-1",
                    contentType === 'live'
                      ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                      : "text-gray-400"
                  )}
                >
                  <Tv className="w-4 h-4" />
                  Live TV
                </button>
                <button
                  onClick={() => handleContentTypeChange('vod')}
                  className={clsx(
                    "flex-1 px-2 py-3 text-sm font-medium transition-colors rounded-t-lg flex flex-col items-center gap-1",
                    contentType === 'vod'
                      ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                      : "text-gray-400"
                  )}
                >
                  <Film className="w-4 h-4" />
                  Movies
                </button>
                <button
                  onClick={() => handleContentTypeChange('series')}
                  className={clsx(
                    "flex-1 px-2 py-3 text-sm font-medium transition-colors rounded-t-lg flex flex-col items-center gap-1",
                    contentType === 'series'
                      ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                      : "text-gray-400"
                  )}
                >
                  <Tv className="w-4 h-4" />
                  Series
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {bottomSheetView === 'categories' ? (
                /* Categories List */
                <div className="space-y-2 pb-8">
                  
                  {(contentType === 'live' ? categories : contentType === 'vod' ? vodCategories : seriesCategories)
                    .filter(cat => cat.title.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                    .map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        handleCategorySelect(cat.id);
                        setBottomSheetView('channels');
                      }}
                      className={clsx(
                        "w-full text-left px-5 py-4 text-base rounded-xl transition-all border border-white/5",
                        selectedCategory === cat.id
                          ? "bg-blue-600/20 text-blue-400 font-medium border-blue-500/30"
                          : "bg-zinc-800/30 text-gray-300 active:bg-zinc-700"
                      )}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>
              ) : (
                /* Channels List */
                <div className="space-y-2 pb-8">
                  <button
                    onClick={() => setBottomSheetView('categories')}
                    className="flex items-center gap-2 text-blue-400 mb-4 px-2 py-2 active:bg-white/5 rounded-lg w-full"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="font-medium">Back to Categories</span>
                  </button>

                  {filteredChannels.map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        handleChannelSelect(channel);
                        setShowBottomSheet(false);
                      }}
                      className={clsx(
                        "w-full text-left px-5 py-4 text-base rounded-xl transition-all flex items-center gap-4 border border-white/5",
                        selectedChannel?.id === channel.id
                          ? "bg-purple-600/20 text-purple-300 font-medium border-purple-500/30"
                          : "bg-zinc-800/30 text-gray-300 active:bg-zinc-700"
                      )}
                    >
                      <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-sm font-mono text-gray-500 shrink-0 border border-white/5">
                        {channel.number}
                      </div>
                      <span className="flex-1 truncate font-medium">{channel.name}</span>
                      {selectedChannel?.id === channel.id && <Play className="w-5 h-5 fill-current shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Logout Button */}
            <div className="p-4 border-t border-white/10 mt-auto bg-zinc-900">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 active:bg-red-500/30 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading player...</div>}>
      <PlayerContent />
    </Suspense>
  );
}
