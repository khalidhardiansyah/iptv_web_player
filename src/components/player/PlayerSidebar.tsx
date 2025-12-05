import { LogOut, Tv, User } from 'lucide-react';
import clsx from 'clsx';
import ContentTypeTabs from './ContentTypeTabs';
import CategoryList from './CategoryList';
import ChannelList from './ChannelList';

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

interface PlayerSidebarProps {
  open: boolean;
  config: any;
  accountInfo: any;
  providerType: ProviderType;
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  categories: Category[];
  channels: Channel[];
  selectedCategory: string | null;
  selectedChannel: Channel | null;
  onCategorySelect: (id: string) => void;
  onChannelSelect: (channel: Channel) => void;
  loadingCategories: boolean;
  loadingChannels: boolean;
  categorySearchQuery: string;
  channelSearchQuery: string;
  onCategorySearchChange: (query: string) => void;
  onChannelSearchChange: (query: string) => void;
  categoryHeight: number;
  onDividerMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
  onLogout: () => void;
}

export default function PlayerSidebar({
  open,
  config,
  accountInfo,
  providerType,
  contentType,
  onContentTypeChange,
  categories,
  channels,
  selectedCategory,
  selectedChannel,
  onCategorySelect,
  onChannelSelect,
  loadingCategories,
  loadingChannels,
  categorySearchQuery,
  channelSearchQuery,
  onCategorySearchChange,
  onChannelSearchChange,
  categoryHeight,
  onDividerMouseDown,
  isDragging,
  onLogout
}: PlayerSidebarProps) {
  return (
    <div className={clsx(
      "sidebar-container flex-col border-r border-white/10 bg-zinc-950 transition-all duration-300 ease-in-out z-20",
      "hidden md:flex",
      open ? "w-80" : "w-0 opacity-0 overflow-hidden"
    )}>
      {/* Header */}
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
          onClick={onLogout}
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
          <ContentTypeTabs
            contentType={contentType}
            onContentTypeChange={onContentTypeChange}
          />
        )}

        {/* Categories */}
        <div className="flex flex-col" style={{ height: `${categoryHeight}%` }}>
          <CategoryList
            categories={categories}
            selectedCategory={selectedCategory}
            onCategorySelect={onCategorySelect}
            loading={loadingCategories}
            searchQuery={categorySearchQuery}
            onSearchChange={onCategorySearchChange}
          />
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={onDividerMouseDown}
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
        <ChannelList
          channels={channels}
          selectedChannel={selectedChannel}
          onChannelSelect={onChannelSelect}
          loading={loadingChannels}
          searchQuery={channelSearchQuery}
          onSearchChange={onChannelSearchChange}
          selectedCategory={selectedCategory}
        />
      </div>
    </div>
  );
}
