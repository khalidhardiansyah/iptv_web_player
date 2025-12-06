'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tv } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BrowserStalkerClient } from '@/lib/browser-stalker';
import { BrowserXtreamClient } from '@/lib/browser-xtream';
import { M3UClient } from '@/lib/m3u-client';
import { SavedPortal } from '@/types/portal';
import BackgroundEffects from '@/components/portal/BackgroundEffects';
import DeleteConfirmationDialog from '@/components/portal/DeleteConfirmationDialog';
import PortalList from '@/components/portal/PortalList';
import PortalForm from '@/components/portal/PortalForm';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // State for Portal Management
  const [portals, setPortals] = useState<SavedPortal[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingPortal, setEditingPortal] = useState<SavedPortal | null>(null);
  
  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          type: p.type,
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

  const handleConnect = async (portal: SavedPortal) => {
    setLoading(true);
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
        const client = new BrowserXtreamClient({ baseUrl: portal.server, username: portal.username, password: portal.password });
        await client.authenticate();
      } else if (portal.type === 'm3u') {
        if (!portal.playlistUrl) throw new Error('Missing M3U playlist URL');
        const client = new M3UClient({ playlistUrl: portal.playlistUrl, username: portal.username, password: portal.password });
        await client.authenticate();
      }
      
      console.log('Attempting to navigate to player with portal ID:', portal.id);
      // Use window.location.href for reliable navigation
      window.location.href = `/player?id=${portal.id}`;
    } catch (err: any) {
      console.error('Connection error:', err);
      alert(`Failed to connect to ${portal.name}: ${err.message}`);
      setLoading(false);
    }
  };

  const handleEdit = (portal: SavedPortal) => {
    setEditingPortal(portal);
    setView('form');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      try {
        const { error } = await supabase.from('portals').delete().eq('id', deleteConfirmId);
        if (error) throw error;
        await fetchPortals();
      } catch (error) {
        console.error('Error deleting portal:', error);
      }
    }
    setDeleteConfirmId(null);
  };

  const handleAddNew = () => {
    setEditingPortal(null);
    setView('form');
  };

  const handleFormSuccess = async (portalId: string) => {
    console.log('handleFormSuccess called with portalId:', portalId);
    await fetchPortals();
    console.log('Redirecting to player with ID:', portalId);
    // Use window.location.href for reliable navigation
    window.location.href = `/player?id=${portalId}`;
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <BackgroundEffects />

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
          <PortalList
            portals={portals}
            onConnect={handleConnect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddNew={handleAddNew}
          />
        ) : (
          <PortalForm
            initialData={editingPortal}
            onSuccess={handleFormSuccess}
            onCancel={() => setView('list')}
            existingPortals={portals}
          />
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

      <DeleteConfirmationDialog
        isOpen={!!deleteConfirmId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
