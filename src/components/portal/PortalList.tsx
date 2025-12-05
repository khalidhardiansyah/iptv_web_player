import { Tv, Plus, Trash2, Edit2, Play } from 'lucide-react';
import clsx from 'clsx';
import { SavedPortal } from '@/types/portal';

interface PortalListProps {
  portals: SavedPortal[];
  onConnect: (portal: SavedPortal) => void;
  onEdit: (portal: SavedPortal) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onAddNew: () => void;
}

export default function PortalList({ portals, onConnect, onEdit, onDelete, onAddNew }: PortalListProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
        {portals.map((portal) => (
          <div
            key={portal.id}
            onClick={() => onConnect(portal)}
            className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-8 hover:from-white/15 hover:to-white/10 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/30 min-h-[280px] flex flex-col"
          >
            {/* Action Buttons */}
            <div className="absolute top-6 right-6 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex gap-2 z-10">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(portal); }}
                className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur rounded-xl text-gray-300 hover:text-white transition-all"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => onDelete(portal.id, e)}
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
          onClick={onAddNew}
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
  );
}
