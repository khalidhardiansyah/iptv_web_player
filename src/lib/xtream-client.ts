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
  private apiEndpoint: string = 'player_api.php';

  constructor(config: { baseUrl: string; username: string; password: string }) {
    // Auto-detect API endpoint from baseUrl
    if (config.baseUrl.includes('get.php')) {
      this.apiEndpoint = 'get.php';
      this.baseUrl = config.baseUrl.split('/get.php')[0];
    } else if (config.baseUrl.includes('player_api.php')) {
      this.apiEndpoint = 'player_api.php';
      this.baseUrl = config.baseUrl.split('/player_api.php')[0];
    } else {
      // Default to player_api.php for backward compatibility
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
      this.apiEndpoint = 'player_api.php';
    }
    
    this.username = config.username;
    this.password = config.password;
  }

  private getApiUrl(action: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.baseUrl}/${this.apiEndpoint}`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    
    // Only add action parameter if it's not empty
    if (action) {
      url.searchParams.set('action', action);
    }
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    return url.toString();
  }

  private async makeRequest(url: string): Promise<Response> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'close'
    };

    return fetch(url, { headers });
  }

  async authenticate(): Promise<XtreamAuthResponse> {
    try {
      const url = this.getApiUrl('');
      console.log('Xtream: Authenticating with URL:', url.replace(this.password, '***'));
      
      const response = await this.makeRequest(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Xtream: Auth response received, auth status:', data.user_info?.auth);
      
      if (data.user_info?.auth !== 1) {
        throw new Error(data.user_info?.message || 'Authentication failed');
      }
      
      this.authInfo = data;
      console.log('Xtream: Authentication successful');

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
      console.log('Xtream: Fetching categories from:', url.replace(this.password, '***'));
      
      const response = await this.makeRequest(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const categories = await response.json();
      console.log('Xtream: Received', Array.isArray(categories) ? categories.length : 0, 'categories');

      return categories;
    } catch (error: any) {
      console.error('Xtream: Failed to fetch categories', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
  }

  async getChannels(categoryId: string): Promise<XtreamChannel[]> {
    try {
      const url = this.getApiUrl('get_live_streams', { category_id: categoryId });

      
      const response = await this.makeRequest(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const channels = await response.json();

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
    

    return streamUrl;
  }
}
