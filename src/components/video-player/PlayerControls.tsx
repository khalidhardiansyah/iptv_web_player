/**
 * PlayerControls Component
 * Video player controls (fullscreen, volume)
 */

import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';

interface PlayerControlsProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export function PlayerControls({
  isFullscreen,
  onToggleFullscreen,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute
}: PlayerControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Volume Controls */}
        <div className="flex items-center gap-2 group">
          <button
            onClick={onToggleMute}
            className="text-white hover:text-blue-400 transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
          
          {/* Volume Slider - shows on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              aria-label="Volume"
            />
          </div>
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          className="text-white hover:text-blue-400 transition-colors"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
      </div>
    </div>
  );
}
