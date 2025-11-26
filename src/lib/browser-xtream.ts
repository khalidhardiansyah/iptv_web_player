// Browser-side Xtream client that uses the Next.js API proxy
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

export class BrowserXtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private authInfo: XtreamAuthResponse | null = null;

  constructor(config: { baseUrl: string; username: string; password: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = config.username;
    this.password = config.password;
  }

  private async callApi(action: string, params: Record<string, any> = {}): Promise<any> {
    const response = await fetch('/api/xtream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        baseUrl: this.baseUrl,
        username: this.username,
        password: this.password,
        ...params,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async authenticate(): Promise<XtreamAuthResponse> {
    try {
      console.log('Xtream: Authenticating via API proxy...', { url: this.baseUrl, username: this.username });
      
      const data = await this.callApi('authenticate');
      
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
      console.log('Xtream: Fetching categories via API proxy...');
      
      const categories = await this.callApi('categories');
      console.log('Xtream: Categories fetched', categories.length);
      return categories;
    } catch (error: any) {
      console.error('Xtream: Failed to fetch categories', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
  }

  async getChannels(categoryId: string): Promise<XtreamChannel[]> {
    try {
      console.log('Xtream: Fetching channels for category', categoryId);
      
      const channels = await this.callApi('channels', { categoryId });
      console.log('Xtream: Channels fetched', channels.length);
      return channels;
    } catch (error: any) {
      console.error('Xtream: Failed to fetch channels', error);
      throw new Error(`Failed to fetch channels: ${error.message}`);
    }
  }

  async getLink(streamId: string): Promise<string> {
    try {
      console.log('Xtream: Getting stream link for', streamId);
      
      const url = await this.callApi('link', { streamId });
      console.log('Xtream: Stream URL generated', url);
      return url;
    } catch (error: any) {
      console.error('Xtream: Failed to get link', error);
      throw new Error(`Failed to get link: ${error.message}`);
    }
  }

  // Handshake method for compatibility with the player page
  async handshake() {
    return this.authenticate();
  }
}
