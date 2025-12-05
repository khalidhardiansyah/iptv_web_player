'use client';

import { Clock, Tv } from 'lucide-react';

interface EPGEntry {
  id?: string;
  time?: string;
  time_to?: string;
  start?: string;
  stop?: string;
  name?: string;
  title?: string;
  descr?: string;
  description?: string;
}

interface EPGPanelProps {
  epgData: EPGEntry[];
  loading?: boolean;
}

export default function EPGPanel({ epgData, loading }: EPGPanelProps) {
  if (loading) {
    return (
      <div className="p-3 bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Tv className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Program Guide</h3>
        </div>
        <div className="text-xs text-gray-400">Loading EPG...</div>
      </div>
    );
  }

  if (!epgData || epgData.length === 0) {
    return (
      <div className="p-3 bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Tv className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Program Guide</h3>
        </div>
        <div className="text-xs text-gray-400">No EPG data available</div>
      </div>
    );
  }

  const formatTime = (timeStr: string) => {
    try {
      // Handle Unix timestamp
      if (!isNaN(Number(timeStr))) {
        const date = new Date(Number(timeStr) * 1000);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
      // Handle ISO date string
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const getCurrentProgram = () => {
    const now = Date.now() / 1000; // Unix timestamp in seconds
    return epgData.find(entry => {
      const start = Number(entry.time || entry.start);
      const end = Number(entry.time_to || entry.stop);
      return start <= now && now <= end;
    });
  };

  const getUpcomingPrograms = () => {
    const now = Date.now() / 1000;
    return epgData
      .filter(entry => {
        const start = Number(entry.time || entry.start);
        return start > now;
      })
      .slice(0, 3); // Show next 3 programs
  };

  const currentProgram = getCurrentProgram();
  const upcomingPrograms = getUpcomingPrograms();

  return (
    <div className="p-3 bg-gray-800/50 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <Tv className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Program Guide</h3>
      </div>

      {/* Current Program */}
      {currentProgram && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded p-2">
          <div className="flex items-center gap-1 text-blue-400 mb-1">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-medium">NOW PLAYING</span>
          </div>
          <div className="text-sm font-medium text-white mb-1">
            {currentProgram.name || currentProgram.title || 'Untitled'}
          </div>
          <div className="text-xs text-gray-300">
            {formatTime(currentProgram.time || currentProgram.start || '')} - {formatTime(currentProgram.time_to || currentProgram.stop || '')}
          </div>
          {(currentProgram.descr || currentProgram.description) && (
            <div className="text-xs text-gray-400 mt-1 line-clamp-2">
              {currentProgram.descr || currentProgram.description}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Programs */}
      {upcomingPrograms.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-400 uppercase">Up Next</div>
          {upcomingPrograms.map((program, index) => (
            <div key={index} className="bg-gray-700/30 rounded p-2">
              <div className="text-sm font-medium text-white mb-1">
                {program.name || program.title || 'Untitled'}
              </div>
              <div className="text-xs text-gray-400">
                {formatTime(program.time || program.start || '')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
