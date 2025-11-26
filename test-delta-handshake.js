// Test delta8k.xyz handshake with timing
const testHandshake = async () => {
  const url = 'http://delta8k.xyz/server/load.php?type=stb&action=handshake&token=&mac=00:1A:79:7E:6F:94';
  
  console.log('Testing delta8k.xyz handshake...');
  console.log('URL:', url);
  console.log('Start time:', new Date().toISOString());
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('End time:', new Date().toISOString());
    console.log('Duration:', duration, 'ms');
    console.log('Status:', response.status, response.statusText);
    
    const data = await response.text();
    console.log('Response:', data.substring(0, 500));
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('Error after', duration, 'ms');
    console.error('Error:', error.message);
    console.error('Error code:', error.cause?.code);
  }
};

testHandshake();
