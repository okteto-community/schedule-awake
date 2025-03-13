const axios = require('axios');

describe('Health Check Integration Test', () => {
  test('should connect to the actual health check endpoint', async () => {
    // Skip this test if not running in Okteto environment
    if (!process.env.OKTETO_NAMESPACE) {
      console.log('Skipping integration test: Not running in Okteto environment');
      return;
    }

    try {
      // Get the endpoint URL from environment or use the default
      const baseUrl = process.env.API_URL || 'http://localhost';
      console.log(`Testing health check endpoint at: ${baseUrl}/api/health`);
      
      const response = await axios.get(`${baseUrl}/api/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('database', 'connected');
      expect(response.data).toHaveProperty('timestamp');
      
      console.log('Health check integration test passed!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Integration test failed:', error.message);
      throw error;
    }
  });
});