// Test delta8k stream URL
const testStream = async () => {
  const streamUrl = 'http://delta8k.xyz:80/play/live.php?mac=A0:BB:3E:01:69:01&stream=1474919&extension=ts&play_token=AV5RZvHt02&sn2=';
  
  console.log('Testing stream URL...');
  console.log('URL:', streamUrl);
  
  try {
    const response = await fetch(streamUrl, {
      method: 'HEAD', // Just check headers
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 456) {
      // Try to get body
      const fullResponse = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });
      const body = await fullResponse.text();
      console.log('Error body:', body.substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testStream();
