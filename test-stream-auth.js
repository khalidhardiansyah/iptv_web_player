// Test if the stream URL requires a fresh authentication
const testStreamAuth = async () => {
  const baseUrl = 'http://103.161.34.27:8080';
  const username = 'alixxxsoylemezz';
  const password = 'U5tjCUTtKytD';
  
  console.log('Testing stream authentication timing...\n');

  // Step 1: Authenticate
  const authUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}`;
  console.log('1. Authenticating...');
  const authResponse = await fetch(authUrl);
  const authData = await authResponse.json();
  
  if (authData.user_info?.auth !== 1) {
    console.log('Authentication failed!');
    return;
  }
  console.log('✓ Authenticated');
  
  // Step 2: Get categories
  const catsUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_live_categories`;
  console.log('\n2. Getting categories...');
  const catsResponse = await fetch(catsUrl);
  const catsData = await catsResponse.json();
  console.log(`✓ Got ${catsData.length} categories`);
  
  // Step 3: Get channels
  const categoryId = catsData[0].category_id;
  const channelsUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_live_streams&category_id=${categoryId}`;
  console.log(`\n3. Getting channels for category ${categoryId}...`);
  const channelsResponse = await fetch(channelsUrl);
  const channelsData = await channelsResponse.json();
  console.log(`✓ Got ${channelsData.length} channels`);
  
  // Step 4: Try to access stream immediately
  const streamId = channelsData[0].stream_id;
  const protocol = authData.server_info?.server_protocol || 'http';
  const port = authData.server_info?.port || '8080';
  const hostname = new URL(baseUrl).hostname;
  
  const streamUrl = `${protocol}://${hostname}:${port}/live/${username}/${password}/${streamId}.ts`;
  
  console.log(`\n4. Testing stream access IMMEDIATELY after API calls...`);
  console.log('Stream URL:', streamUrl);
  
  const streamResponse1 = await fetch(streamUrl, {
    method: 'HEAD',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': `${protocol}://${hostname}:${port}/`,
      'Origin': `${protocol}://${hostname}:${port}`,
      'Accept': '*/*',
      'Connection': 'keep-alive'
    }
  });
  
  console.log('Status:', streamResponse1.status, streamResponse1.statusText);
  
  if (streamResponse1.status === 401) {
    console.log('\n5. Stream failed with 401. Trying again after 2 second delay...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const streamResponse2 = await fetch(streamUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': `${protocol}://${hostname}:${port}/`,
        'Origin': `${protocol}://${hostname}:${port}`,
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    });
    
    console.log('Status after delay:', streamResponse2.status, streamResponse2.statusText);
  }
};

testStreamAuth().catch(console.error);
