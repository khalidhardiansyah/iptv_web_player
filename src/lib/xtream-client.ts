export interface XtreamAuthResponse {
  user_info: {
    username: string;
    password: string;
    message: string;
    auth: number;
    status: string;
    exp_date: string;
    is_trial: string;
    active_cons: string;
    created_at: string;
    max_connections: string;
    allowed_output_formats: string[];
  };
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    rtmp_port: string;
    timezone: string;
    timestamp_now: number;
    time_now: string;
  };
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamChannel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export class XtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private authInfo: XtreamAuthResponse | null = null;

  constructor(config: { baseUrl: string; username: string; password: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = config.username;
    this.password = config.password;
  }

  private getApiUrl(action: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.baseUrl}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    url.searchParams.set('action', action);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    return url.toString();
  }

  async authenticate(): Promise<XtreamAuthResponse> {
    try {
      const url = this.getApiUrl('');
      console.log('Xtream: Authenticating...', { url: this.baseUrl, username: this.username });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.user_info?.auth !== 1) {
        throw new Error(data.user_info?.message || 'Authentication failed');
      }
      
      this.authInfo = data;
      console.log('Xtream: Authentication successful', data.user_info);
      return data;
    } catch (error: any) {
      console.error('Xtream: Authentication failed', error);
      throw new Error(`Failed to authenticate: ${error.message}`);
    }
  }

  async getProfile() {
    if (!this.authInfo) {
      await this.authenticate();
    }
    return this.authInfo?.user_info;
  }

  async getCategories(): Promise<XtreamCategory[]> {
    try {
      const url = this.getApiUrl('get_live_categories');
      console.log('Xtream: Fetching categories...');
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const categories = await response.json();
      console.log('Xtream: Categories fetched', categories.length);
      return categories;
    } catch (error: any) {
      console.error('Xtream: Failed to fetch categories', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
  }

  async getChannels(categoryId: string): Promise<XtreamChannel[]> {
    try {
      const url = this.getApiUrl('get_live_streams', { category_id: categoryId });
      console.log('Xtream: Fetching channels for category', categoryId);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const channels = await response.json();
      console.log('Xtream: Channels fetched', channels.length);
      return channels;
    } catch (error: any) {
      console.error('Xtream: Failed to fetch channels', error);
      throw new Error(`Failed to fetch channels: ${error.message}`);
    }
  }

  async getLink(streamId: string): Promise<string> {
    // Ensure we're authenticated to get server info
    if (!this.authInfo) {
      await this.authenticate();
    }
    
    // Xtream stream URL format: http://server:port/live/username/password/streamId.ext
    
    // Parse baseUrl to extract hostname and port
    const urlObj = new URL(this.baseUrl);
    const hostname = urlObj.hostname;
    const basePort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
    
    // Use server info if available, otherwise use baseUrl info
    const protocol = this.authInfo?.server_info?.server_protocol || urlObj.protocol.replace(':', '');
    const port = this.authInfo?.server_info?.port || basePort;
    
    // Build stream URL
    const streamUrl = `${protocol}://${hostname}:${port}/live/${this.username}/${this.password}/${streamId}.ts`;
    
    console.log('Xtream: Generated stream URL', streamUrl);
    return streamUrl;
  }
}
