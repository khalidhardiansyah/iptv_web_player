import { Tv, Film } from 'lucide-react';
import clsx from 'clsx';

type ContentType = 'live' | 'vod' | 'series';

interface ContentTypeTabsProps {
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  isMobile?: boolean;
}

export default function ContentTypeTabs({ contentType, onContentTypeChange, isMobile = false }: ContentTypeTabsProps) {
  if (isMobile) {
    return (
      <div className="flex border-b border-white/10 px-4 pt-4">
        <button
          onClick={() => onContentTypeChange('live')}
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
          onClick={() => onContentTypeChange('vod')}
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
          onClick={() => onContentTypeChange('series')}
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
    );
  }

  return (
    <div className="flex border-b border-white/10 bg-zinc-950">
      <button
        onClick={() => onContentTypeChange('live')}
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
        onClick={() => onContentTypeChange('vod')}
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
        onClick={() => onContentTypeChange('series')}
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
  );
}
