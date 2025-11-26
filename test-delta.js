// Test delta8k.xyz server connectivity
const testDelta = async () => {
  const url = 'http://delta8k.xyz/server/load.php?type=stb&action=handshake&token=&mac=00:1A:79:46:31:49';
  
  console.log('Testing delta8k.xyz server...');
  console.log('URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      },
    });
    
    console.log('Status:', response.status, response.statusText);
    const data = await response.text();
    console.log('Response:', data.substring(0, 500));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Error code:', error.cause?.code);
    console.error('Error details:', error);
  }
};

testDelta();
