// Test Xtream stream URL generation
const testStreamUrl = async () => {
  const baseUrl = 'http://103.161.34.27:8080';
  const username = 'alixxxsoylemezz';
  const password = 'U5tjCUTtKytD';
  
  console.log('Testing Xtream stream URL generation...');
  console.log('Base URL:', baseUrl);
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('---');

  // Test authentication
  try {
    const authUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}`;
    console.log('\n1. Testing authentication:');
    console.log('URL:', authUrl);
    
    const authResponse = await fetch(authUrl);
    const authData = await authResponse.json();
    console.log('Auth Status:', authData.user_info?.auth === 1 ? 'SUCCESS' : 'FAILED');
    console.log('Server Info:', authData.server_info);
    
    // Generate stream URL
    const streamId = '472584';
    const protocol = authData.server_info?.server_protocol || 'http';
    const port = authData.server_info?.port || '8080';
    const hostname = new URL(baseUrl).hostname;
    
    const streamUrl = `${protocol}://${hostname}:${port}/live/${username}/${password}/${streamId}.ts`;
    console.log('\n2. Generated stream URL:', streamUrl);
    
    // Test stream URL
    console.log('\n3. Testing stream URL...');
    const streamResponse = await fetch(streamUrl, { method: 'HEAD' });
    console.log('Stream Status:', streamResponse.status);
    console.log('Stream Headers:', Object.fromEntries(streamResponse.headers.entries()));
    
  } catch (error) {
    console.error('ERROR:', error.message);
  }
};

testStreamUrl();
