// Test Xtream stream URL
const testXtreamStream = async () => {
  const streamUrl = 'http://1.dn-loukos.com:80/live/8eb8273b84/matijaGR/704490.ts';
  
  console.log('Testing Xtream stream URL...');
  console.log('URL:', streamUrl);
  console.log('Start time:', new Date().toISOString());
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(streamUrl, {
      method: 'HEAD', // Just check headers first
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('End time:', new Date().toISOString());
    console.log('Duration:', duration, 'ms');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status !== 200) {
      console.log('\n⚠️ Stream not available (status:', response.status, ')');
      console.log('This could mean:');
      console.log('- Stream is offline');
      console.log('- Authentication expired');
      console.log('- Server is blocking requests');
    } else {
      console.log('\n✅ Stream is accessible!');
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('\n❌ Error after', duration, 'ms');
    console.error('Error:', error.message);
    console.error('Error code:', error.cause?.code);
    
    if (error.cause?.code === 'ENOTFOUND') {
      console.log('\n💡 Server hostname not found - server may be down or URL incorrect');
    } else if (error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNRESET') {
      console.log('\n💡 Connection timeout - server is too slow or unreachable');
    }
  }
};

testXtreamStream();
