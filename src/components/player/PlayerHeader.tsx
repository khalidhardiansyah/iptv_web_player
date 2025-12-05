import { Menu } from 'lucide-react';

interface Channel {
  id: string;
  number?: string;
  name: string;
  cmd?: string;
  logo?: string;
  stream_id?: number;
  url?: string;
}

interface PlayerHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedChannel: Channel | null;
  categoryTitle: string | undefined;
}

export default function PlayerHeader({ 
  sidebarOpen, 
  onToggleSidebar, 
  selectedChannel, 
  categoryTitle 
}: PlayerHeaderProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
      <button
        onClick={onToggleSidebar}
        className="pointer-events-auto p-2 bg-black/50 backdrop-blur rounded-lg text-white hover:bg-white/20 transition-colors hidden md:block"
      >
        <Menu className="w-5 h-5" />
      </button>
      {selectedChannel && (
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white drop-shadow-md">{selectedChannel.name}</h2>
          <span className="text-xs text-gray-300 drop-shadow">{categoryTitle}</span>
        </div>
      )}
    </div>
  );
}
