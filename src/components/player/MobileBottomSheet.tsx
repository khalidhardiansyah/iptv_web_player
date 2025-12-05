import { X, ChevronLeft, Play, LogOut, Menu } from 'lucide-react';
import clsx from 'clsx';
import SearchInput from './SearchInput';
import ContentTypeTabs from './ContentTypeTabs';

type ProviderType = 'stalker' | 'xtream' | 'm3u';
type ContentType = 'live' | 'vod' | 'series';

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

interface MobileBottomSheetProps {
  show: boolean;
  onClose: () => void;
  view: 'categories' | 'channels';
  onViewChange: (view: 'categories' | 'channels') => void;
  providerType: ProviderType;
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  categories: Category[];
  channels: Channel[];
  selectedCategory: string | null;
  selectedChannel: Channel | null;
  onCategorySelect: (id: string) => void;
  onChannelSelect: (channel: Channel) => void;
  categorySearchQuery: string;
  channelSearchQuery: string;
  onCategorySearchChange: (query: string) => void;
  onChannelSearchChange: (query: string) => void;
  onLogout: () => void;
}

export default function MobileBottomSheet({
  show,
  onClose,
  view,
  onViewChange,
  providerType,
  contentType,
  onContentTypeChange,
  categories,
  channels,
  selectedCategory,
  selectedChannel,
  onCategorySelect,
  onChannelSelect,
  categorySearchQuery,
  channelSearchQuery,
  onCategorySearchChange,
  onChannelSearchChange,
  onLogout
}: MobileBottomSheetProps) {
  if (!show) return null;

  const filteredCategories = categories.filter(cat =>
    cat.title.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(channelSearchQuery.toLowerCase())
  );

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up shadow-2xl border-t border-white/10">
        {/* Handle */}
        <div className="flex justify-center py-3" onClick={onClose}>
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-white/10">
          <h2 className="text-xl font-bold">
            {view === 'categories' ? 'Categories' : 'Channels'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Fixed Search Bar */}
        <div className="px-4 py-2 border-b border-white/10 bg-zinc-900 z-10">
          <SearchInput
            value={view === 'categories' ? categorySearchQuery : channelSearchQuery}
            onChange={view === 'categories' ? onCategorySearchChange : onChannelSearchChange}
            placeholder={view === 'categories' ? "Search categories..." : "Search channels..."}
            className="bg-zinc-800 border-white/10 rounded-xl pl-10 pr-4 py-3 text-base"
          />
        </div>

        {/* Content Type Tabs (for Stalker) */}
        {providerType === 'stalker' && view === 'categories' && (
          <ContentTypeTabs
            contentType={contentType}
            onContentTypeChange={onContentTypeChange}
            isMobile={true}
          />
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'categories' ? (
            /* Categories List */
            <div className="space-y-2 pb-8">
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onCategorySelect(cat.id);
                    onViewChange('channels');
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
                onClick={() => onViewChange('categories')}
                className="flex items-center gap-2 text-blue-400 mb-4 px-2 py-2 active:bg-white/5 rounded-lg w-full"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Back to Categories</span>
              </button>

              {filteredChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => {
                    onChannelSelect(channel);
                    onClose();
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
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 active:bg-red-500/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
