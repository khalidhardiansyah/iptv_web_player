// Test the specific Xtream server
const testServer = async () => {
  const baseUrl = 'http://103.161.34.27:8080';
  const username = 'alixxxsoylemezz';
  const password = 'U5tjCUTtKytD';
  
  console.log('='.repeat(60));
  console.log('Testing Xtream Server:', baseUrl);
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('='.repeat(60));

  // Test 1: Authentication
  try {
    const authUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}`;
    console.log('\n[AUTH] URL:', authUrl);
    
    const authResponse = await fetch(authUrl);
    const authData = await authResponse.json();
    
    if (authData.user_info?.auth === 1) {
      console.log('[AUTH] ✓ SUCCESS');
      console.log('Server Protocol:', authData.server_info?.server_protocol);
      console.log('Server Port:', authData.server_info?.port);
      console.log('Server URL:', authData.server_info?.url);
    } else {
      console.log('[AUTH] ✗ FAILED:', authData.user_info?.message);
      return;
    }
    
    // Test 2: Get categories
    const catsUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_live_categories`;
    console.log('\n[CATEGORIES] URL:', catsUrl);
    
    const catsResponse = await fetch(catsUrl);
    const catsData = await catsResponse.json();
    console.log('[CATEGORIES] Count:', catsData.length);
    if (catsData.length > 0) {
      console.log('[CATEGORIES] First:', catsData[0]);
    }
    
    // Test 3: Get channels from first category
    if (catsData.length > 0) {
      const categoryId = catsData[0].category_id;
      const channelsUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_live_streams&category_id=${categoryId}`;
      console.log('\n[CHANNELS] URL:', channelsUrl);
      
      const channelsResponse = await fetch(channelsUrl);
      const channelsData = await channelsResponse.json();
      console.log('[CHANNELS] Count:', channelsData.length);
      if (channelsData.length > 0) {
        const firstChannel = channelsData[0];
        console.log('[CHANNELS] First channel:', {
          name: firstChannel.name,
          stream_id: firstChannel.stream_id,
          num: firstChannel.num
        });
        
        // Test 4: Generate stream URL
        const streamId = firstChannel.stream_id;
        const protocol = authData.server_info?.server_protocol || 'http';
        const port = authData.server_info?.port || '8080';
        const hostname = new URL(baseUrl).hostname;
        
        const streamUrl = `${protocol}://${hostname}:${port}/live/${username}/${password}/${streamId}.ts`;
        console.log('\n[STREAM] Generated URL:', streamUrl);
        
        // Test stream access
        try {
          const streamResponse = await fetch(streamUrl, { 
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Referer': `${protocol}://${hostname}:${port}/`
            }
          });
          console.log('[STREAM] Status:', streamResponse.status, streamResponse.statusText);
          
          if (streamResponse.status === 401) {
            console.log('[STREAM] ✗ 401 Unauthorized - Authentication failed');
            console.log('[STREAM] Trying without .ts extension...');
            
            const streamUrl2 = `${protocol}://${hostname}:${port}/live/${username}/${password}/${streamId}`;
            const streamResponse2 = await fetch(streamUrl2, { 
              method: 'HEAD',
              headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': `${protocol}://${hostname}:${port}/`
              }
            });
            console.log('[STREAM] Status (no ext):', streamResponse2.status, streamResponse2.statusText);
          } else if (streamResponse.status === 200) {
            console.log('[STREAM] ✓ SUCCESS');
          }
        } catch (streamError) {
          console.error('[STREAM] Error:', streamError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
  }
};

testServer();
