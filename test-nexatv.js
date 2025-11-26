// Test nexatv.be portal
const testNexatv = async () => {
  const baseUrl = 'http://new.nexatv.be/stalker_portal/c/';
  const mac = '00:1A:79:00:00:09';
  
  console.log('Testing nexatv.be portal...');
  console.log('Base URL:', baseUrl);
  console.log('MAC:', mac);
  
  // Step 1: Handshake
  try {
    const handshakeUrl = `${baseUrl}server/load.php?type=stb&action=handshake&token=&mac=${encodeURIComponent(mac)}`;
    console.log('\n1. Handshake URL:', handshakeUrl);
    
    const handshakeResponse = await fetch(handshakeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      },
    });
    
    console.log('Handshake Status:', handshakeResponse.status);
    const handshakeData = await handshakeResponse.text();
    console.log('Handshake Response:', handshakeData);
    
    let token = '';
    try {
      const jsonData = JSON.parse(handshakeData);
      token = jsonData.js?.token || '';
      console.log('Token:', token);
    } catch (e) {
      console.error('Failed to parse handshake response');
      return;
    }
    
    if (!token) {
      console.error('No token received');
      return;
    }
    
    // Step 2: Get genres (categories)
    const genresUrl = `${baseUrl}server/load.php?type=itv&action=get_genres&mac=${encodeURIComponent(mac)}&token=${token}`;
    console.log('\n2. Genres URL:', genresUrl);
    
    const genresResponse = await fetch(genresUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'Cookie': `mac=${encodeURIComponent(mac)}; stb_lang=en; timezone=UTC`,
      },
    });
    
    console.log('Genres Status:', genresResponse.status);
    const genresData = await genresResponse.text();
    console.log('Genres Response:', genresData.substring(0, 1000));
    
    try {
      const jsonData = JSON.parse(genresData);
      console.log('Number of genres:', jsonData.js?.length || 0);
      if (jsonData.js && jsonData.js.length > 0) {
        console.log('First genre:', jsonData.js[0]);
      }
    } catch (e) {
      console.error('Failed to parse genres response');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Error code:', error.cause?.code);
  }
};

testNexatv();
