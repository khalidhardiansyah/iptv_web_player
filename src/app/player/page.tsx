'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import { BrowserStalkerClient } from '@/lib/browser-stalker';
import { BrowserXtreamClient } from '@/lib/browser-xtream';
import { M3UClient } from '@/lib/m3u-client';
import { supabase } from '@/lib/supabase';
import PlayerSidebar from '@/components/player/PlayerSidebar';
import PlayerHeader from '@/components/player/PlayerHeader';
import MobileBottomSheet from '@/components/player/MobileBottomSheet';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
  const [categoryHeight, setCategoryHeight] = useState(33);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalChannels, setTotalChannels] = useState(0);
  const CHANNELS_PER_PAGE = 100;
  
  const [contentType, setContentType] = useState<ContentType>('live');
  const [vodCategories, setVodCategories] = useState<Category[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<Category[]>([]);
  
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
        } catch (error) {
          console.error('Failed to load portal:', error);
          router.push('/');
          return;
        }
      } else {
        const url = localStorage.getItem('stalker_url');
        const mac = localStorage.getItem('stalker_mac');
        if (!url || !mac) {
          router.push('/');
          return;
        }
        currentConfig = { url, mac };
      }

      setConfig(currentConfig);
      setProviderType(type);

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
    let handshakeSuccess = false;
    
    try {
      console.log('🔐 Starting authentication...');
      if (typeof client.handshake === 'function') {
        try {
          await client.handshake();
          console.log('✅ Handshake successful');
          handshakeSuccess = true;
        } catch (handshakeError: any) {
          console.error('❌ Handshake failed:', handshakeError.message);
          console.warn('⚠️ Attempting to continue without handshake...');
        }
      } else if (typeof client.authenticate === 'function') {
        try {
          await client.authenticate();
          console.log('✅ Authentication successful');
          handshakeSuccess = true;
        } catch (authError: any) {
          console.error('❌ Authentication failed:', authError.message);
          console.warn('⚠️ Attempting to continue without authentication...');
        }
      }
      
      if (handshakeSuccess) {
        try {
          const profile = await client.getProfile();
          console.log('✅ Profile fetched');
          setAccountInfo(profile);
        } catch (profileError: any) {
          console.error('❌ Failed to fetch profile:', profileError.message);
        }
      }
      
      console.log('📺 Fetching categories...');
      const cats = await client.getCategories();
      console.log('📊 Categories response:', cats);

      if (!cats || cats.length === 0) {
        console.warn('⚠️ No categories returned from provider');
        setCategories([]);
        return;
      }
      
      const normalizedCategories = cats?.map((cat: any) => ({
        id: cat.id || cat.category_id?.toString() || '',
        title: cat.title || cat.category_name || 'Unknown',
        alias: cat.alias || ''
      })) || [];
      
      console.log(`✅ Normalized ${normalizedCategories.length} categories`);
      
      if (typeof client.getAllChannels === 'function') {
        normalizedCategories.unshift({
          id: '__ALL__',
          title: '📺 All Channels',
          alias: 'all'
        });
      }
      
      setCategories(normalizedCategories);
      
      if (normalizedCategories.length === 0) {
        console.warn('⚠️ No categories after normalization');
      } else {
        console.log(`✅ Successfully loaded ${normalizedCategories.length} categories`);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch categories:', error);
      console.error('📋 Error details:', {
        message: error.message,
        name: error.name
      });
      
      setCategories([]);
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
    
    if (type === 'vod' && vodCategories.length === 0) {
      fetchVODCategories(clientRef.current);
    } else if (type === 'series' && seriesCategories.length === 0) {
      fetchSeriesCategories(clientRef.current);
    }
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (!clientRef.current) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setSelectedCategory(categoryId);
    setLoadingChannels(true);
    setChannels([]);
    setCurrentPage(1);
    
    try {
      let chs = [];
      
      if (contentType === 'live') {
        if (categoryId === '__ALL__' && typeof clientRef.current.getAllChannels === 'function') {
          // Check if aborted before making request
          if (signal.aborted) return;
          chs = await clientRef.current.getAllChannels();
          // Check again after async operation
          if (signal.aborted) return;
          setTotalChannels(chs.length);
          chs = chs.slice(0, CHANNELS_PER_PAGE);
        } else {
          chs = await clientRef.current.getChannels(categoryId, false, signal);
          if (signal.aborted) return;
          setTotalChannels(chs.length);
        }
      } else if (contentType === 'vod') {
        chs = await clientRef.current.getVODItems(categoryId, false, signal);
        if (signal.aborted) return;
        setTotalChannels(chs.length);
      } else if (contentType === 'series') {
        chs = await clientRef.current.getSeriesItems(categoryId, false, signal);
        if (signal.aborted) return;
        setTotalChannels(chs.length);
      }
      
      // Final check before setting state
      if (signal.aborted) return;
      
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

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return; // Don't reset loading state, new request is already running
      }
      console.error('Failed to fetch channels', error);
      // Only reset on actual errors, not on abort
      setLoadingChannels(false);
    } finally {
      // Only reset loading if not aborted
      if (!signal.aborted) {
        setLoadingChannels(false);
      }
    }
  };

  const handleChannelSelect = async (channel: Channel) => {
    if (!clientRef.current) return;
    setSelectedChannel(channel);
    setLoadingLink(true);
    setStreamUrl(null);
    
    try {
      let url: string;
      
      if (providerType === 'stalker') {
        const cmd = channel.cmd || channel.id;
        
        if (contentType === 'vod') {
          url = await clientRef.current.getVODLink(cmd);
        } else if (contentType === 'series') {
          url = await clientRef.current.getSeriesLink(cmd, channel.id);
        } else {
          url = await clientRef.current.getLink(cmd);
        }
      } else if (providerType === 'xtream') {
        const streamId = channel.stream_id?.toString() || channel.id;
        url = await clientRef.current.getLink(streamId);
      } else {
        url = await clientRef.current.getLink(channel.id);
      }
      
      if (url) {
        if (providerType === 'stalker') {
          if (url.startsWith('ffrt ')) {
            url = url.substring(5);
          } else if (url.startsWith('ffmpeg ')) {
            url = url.substring(7);
          }

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
        
        console.log('Setting stream URL:', url);
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
      
      const headerHeight = 180;
      const availableHeight = sidebarHeight - headerHeight;
      const mouseY = e.clientY - sidebarRect.top - headerHeight;
      
      let newHeight = (mouseY / availableHeight) * 100;
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

  if (!mounted || !config) return null;

  const currentCategories = contentType === 'live' ? categories : contentType === 'vod' ? vodCategories : seriesCategories;
  const selectedCategoryTitle = currentCategories.find(c => c.id === selectedCategory)?.title;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <PlayerSidebar
        open={sidebarOpen}
        config={config}
        accountInfo={accountInfo}
        providerType={providerType}
        contentType={contentType}
        onContentTypeChange={handleContentTypeChange}
        categories={currentCategories}
        channels={channels}
        selectedCategory={selectedCategory}
        selectedChannel={selectedChannel}
        onCategorySelect={handleCategorySelect}
        onChannelSelect={handleChannelSelect}
        loadingCategories={loadingCategories}
        loadingChannels={loadingChannels}
        categorySearchQuery={categorySearchQuery}
        channelSearchQuery={searchQuery}
        onCategorySearchChange={setCategorySearchQuery}
        onChannelSearchChange={setSearchQuery}
        categoryHeight={categoryHeight}
        onDividerMouseDown={handleDividerMouseDown}
        isDragging={isDragging}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Player Header */}
        <PlayerHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedChannel={selectedChannel}
          categoryTitle={selectedCategoryTitle}
        />

        {/* Player */}
        <div className="flex-1 relative">
          <VideoPlayer 
            src={streamUrl} 
            userAgent={providerType === 'stalker' ? 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3' : undefined}
            cookies={providerType === 'stalker' && clientRef.current ? (clientRef.current as BrowserStalkerClient).getCookies() : undefined}
            token={undefined}
          />
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
      <MobileBottomSheet
        show={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        view={bottomSheetView}
        onViewChange={setBottomSheetView}
        providerType={providerType}
        contentType={contentType}
        onContentTypeChange={handleContentTypeChange}
        categories={currentCategories}
        channels={channels}
        selectedCategory={selectedCategory}
        selectedChannel={selectedChannel}
        onCategorySelect={(id) => {
          handleCategorySelect(id);
          setBottomSheetView('channels');
        }}
        onChannelSelect={handleChannelSelect}
        categorySearchQuery={categorySearchQuery}
        channelSearchQuery={searchQuery}
        onCategorySearchChange={setCategorySearchQuery}
        onChannelSearchChange={setSearchQuery}
        onLogout={handleLogout}
      />
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
