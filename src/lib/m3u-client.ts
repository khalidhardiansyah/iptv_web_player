export interface M3UChannel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
  tvgId?: string;
  tvgName?: string;
}

export interface M3UCategory {
  id: string;
  title: string;
}

export class M3UClient {
  private playlistUrl: string;
  private username?: string;
  private password?: string;
  private channels: M3UChannel[] = [];
  private categories: M3UCategory[] = [];

  constructor(config: { playlistUrl: string; username?: string; password?: string }) {
    this.playlistUrl = config.playlistUrl;
    this.username = config.username;
    this.password = config.password;
  }

  async fetchPlaylist(): Promise<void> {
    try {
      console.log('M3U: Fetching playlist...', this.playlistUrl);
      
      const headers: HeadersInit = {};
      if (this.username && this.password) {
        const auth = btoa(`${this.username}:${this.password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(this.playlistUrl, { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      this.parseM3U(content);
      console.log('M3U: Playlist parsed', { channels: this.channels.length, categories: this.categories.length });
    } catch (error: any) {
      console.error('M3U: Failed to fetch playlist', error);
      throw new Error(`Failed to fetch playlist: ${error.message}`);
    }
  }

  private parseM3U(content: string): void {
    const lines = content.split('\n');
    const channels: M3UChannel[] = [];
    const categorySet = new Set<string>();

    let currentChannel: Partial<M3UChannel> = {};
    let channelIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        // Parse channel info
        const match = line.match(/#EXTINF:(-?\d+)\s*(.*?),(.*)$/);
        if (match) {
          const attributes = match[2];
          const name = match[3].trim();

          // Extract attributes
          const tvgIdMatch = attributes.match(/tvg-id="([^"]*)"/);
          const tvgNameMatch = attributes.match(/tvg-name="([^"]*)"/);
          const tvgLogoMatch = attributes.match(/tvg-logo="([^"]*)"/);
          const groupMatch = attributes.match(/group-title="([^"]*)"/);

          const group = groupMatch ? groupMatch[1] : 'Uncategorized';
          categorySet.add(group);

          currentChannel = {
            id: `channel_${channelIndex++}`,
            name: name || tvgNameMatch?.[1] || 'Unknown',
            logo: tvgLogoMatch?.[1],
            group,
            tvgId: tvgIdMatch?.[1],
            tvgName: tvgNameMatch?.[1],
          };
        }
      } else if (line && !line.startsWith('#') && currentChannel.name) {
        // This is the stream URL
        currentChannel.url = line;
        channels.push(currentChannel as M3UChannel);
        currentChannel = {};
      }
    }

    this.channels = channels;
    this.categories = Array.from(categorySet).map((title, index) => ({
      id: `cat_${index}`,
      title,
    }));
  }

  async authenticate(): Promise<void> {
    // M3U doesn't have authentication, just fetch the playlist
    await this.fetchPlaylist();
  }

  async getProfile() {
    return {
      name: 'M3U Playlist',
      status: 'active',
      channels_count: this.channels.length,
    };
  }

  async getCategories(): Promise<M3UCategory[]> {
    if (this.categories.length === 0) {
      await this.fetchPlaylist();
    }
    return this.categories;
  }

  async getChannels(categoryId: string): Promise<M3UChannel[]> {
    if (this.channels.length === 0) {
      await this.fetchPlaylist();
    }

    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      return [];
    }

    return this.channels.filter(ch => ch.group === category.title);
  }

  async getLink(channelId: string): Promise<string> {
    const channel = this.channels.find(ch => ch.id === channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }
    return channel.url;
  }
}
