/**
 * PlayerCore Component
 * Core video element wrapper with basic event handlers
 */

import { forwardRef, ReactEventHandler } from 'react';

interface PlayerCoreProps {
  poster?: string;
  onLoadedData?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
  onError?: ReactEventHandler<HTMLVideoElement>;
}

export const PlayerCore = forwardRef<HTMLVideoElement, PlayerCoreProps>(
  ({ poster, onLoadedData, onWaiting, onPlaying, onError }, ref) => {
    return (
      <video
        ref={ref}
        className="w-full h-full"
        poster={poster}
        playsInline
        onLoadedData={onLoadedData}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onError={onError}
      />
    );
  }
);

PlayerCore.displayName = 'PlayerCore';
