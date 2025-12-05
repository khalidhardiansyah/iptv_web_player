/**
 * PlayerOverlay Component
 * Loading states, error messages, and poster display
 */

import { AlertCircle, Loader2, Film } from 'lucide-react';

interface PlayerOverlayProps {
  loading: boolean;
  error: string | null;
  poster?: string;
  isTransmuxing?: boolean;
  transmuxProgress?: number;
}

export function PlayerOverlay({
  loading,
  error,
  poster,
  isTransmuxing,
  transmuxProgress
}: PlayerOverlayProps) {
  // Show error
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
        <div className="text-center p-6 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Playback Error</p>
          <p className="text-gray-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Show transmuxing progress
  if (isTransmuxing) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
        <div className="text-center p-6">
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-white text-lg mb-2">Converting MKV file...</p>
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${transmuxProgress}%` }}
            />
          </div>
          <p className="text-gray-300 text-sm mt-2">{transmuxProgress}%</p>
        </div>
      </div>
    );
  }

  // Show loading
  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-white mx-auto mb-4 animate-spin" />
          <p className="text-white text-lg">Loading stream...</p>
        </div>
      </div>
    );
  }

  // Show poster when not playing
  if (poster) {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center z-10"
        style={{ backgroundImage: `url(${poster})` }}
      >
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <Film className="w-24 h-24 text-white/50" />
        </div>
      </div>
    );
  }

  return null;
}
