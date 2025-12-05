import { Play } from 'lucide-react';
import clsx from 'clsx';
import SearchInput from './SearchInput';

interface Channel {
  id: string;
  number?: string;
  name: string;
  cmd?: string;
  logo?: string;
  stream_id?: number;
  url?: string;
}

interface ChannelListProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string | null;
}

export default function ChannelList({
  channels,
  selectedChannel,
  onChannelSelect,
  loading,
  searchQuery,
  onSearchChange,
  selectedCategory
}: ChannelListProps) {
  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-white/10 bg-zinc-950 sticky top-0 z-10">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search channels..."
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm animate-pulse">Loading channels...</div>
        ) : selectedCategory ? (
          filteredChannels.length > 0 ? (
            filteredChannels.map(channel => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel)}
                className={clsx(
                  "w-full text-left px-4 py-3 text-sm transition-all flex items-center gap-3 group border-b border-white/5",
                  selectedChannel?.id === channel.id
                    ? "bg-purple-600/20 text-purple-300"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="w-8 h-8 rounded object-cover shrink-0 bg-zinc-900"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={clsx(
                  "w-8 h-8 bg-zinc-900 rounded flex items-center justify-center text-xs font-mono text-gray-600 shrink-0",
                  channel.logo && "hidden"
                )}>
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
    </div>
  );
}
