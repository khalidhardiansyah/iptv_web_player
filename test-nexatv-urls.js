// Test different URL variations for nexatv.be
const testUrls = async () => {
  const mac = '00:1A:79:00:00:09';
  
  const urls = [
    'http://new.nexatv.be/stalker_portal/c/',
    'http://new.nexatv.be/stalker_portal/',
    'http://new.nexatv.be/',
  ];
  
  for (const baseUrl of urls) {
    console.log('\n' + '='.repeat(60));
    console.log('Testing base URL:', baseUrl);
    console.log('='.repeat(60));
    
    const handshakeUrl = `${baseUrl}server/load.php?type=stb&action=handshake&token=&mac=${encodeURIComponent(mac)}`;
    console.log('Full URL:', handshakeUrl);
    
    try {
      const response = await fetch(handshakeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        },
      });
      
      console.log('Status:', response.status, response.statusText);
      
      if (response.status === 200) {
        const data = await response.text();
        console.log('Response:', data.substring(0, 200));
        console.log('✅ THIS URL WORKS!');
        break;
      } else {
        const data = await response.text();
        console.log('Error response:', data.substring(0, 200));
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
};

testUrls();
