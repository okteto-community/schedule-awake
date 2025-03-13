const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

describe('API Integration Test', () => {
  test('should create, get, and delete a schedule using the health check endpoint', async () => {
    // Use environment variable for API URL
    const API_URL = process.env.API_URL || 'http://localhost:8080';
    console.log(`Using API URL: ${API_URL}`);

  const testNamespace = 'test-namespace-' + uuidv4().substring(0, 8);
  const testSchedule = '0 9 * * *';  
  
    console.log('1. Creating a new schedule...');
    const createResponse = await axios.post(`${API_URL}/api/schedules`, {
      namespace: testNamespace,
      schedule: testSchedule
    })
  
    expect(createResponse.status).toBe(201);
    expect(createResponse.data).toHaveProperty('id');
    expect(createResponse.data).toHaveProperty('schedule');
    expect(createResponse.data).toHaveProperty('namespace');
    
    console.log('2. Getting all schedules...');
    const getResponse = await axios.get(`${API_URL}/api/schedules`);
    
    const createdSchedule = getResponse.data.find(s => s.id === createResponse.data.id);
    expect(createdSchedule).not.toBe(undefined);
    expect(createdSchedule.id).toBe(createResponse.data.id);
    
    console.log('3. Deleting the schedule...');
    const deleteResponse = await axios.delete(`${API_URL}/api/schedules/${createResponse.data.id}`);
    
    console.log('Delete response status:', deleteResponse.status);
    expect(deleteResponse.status).toBe(200);
    
    console.log('4. Verifying the schedule was deleted...');
    const verifyResponse = await axios.get(`${API_URL}/api/schedules`);
    
    const deletedSchedule = verifyResponse.data.find(s => s.id === createResponse.data.id);
    expect(deletedSchedule).toBe(undefined);  
  })
})  
