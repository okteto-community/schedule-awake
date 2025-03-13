const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Use environment variable for API URL
const API_URL = process.env.API_URL || 'http://localhost:8080';
console.log(`Using API URL: ${API_URL}`);

async function runTests() {
  const testNamespace = 'test-namespace-' + uuidv4().substring(0, 8);
  const testSchedule = '0 9 * * *';
  let testScheduleId;
  
  try {
    console.log('1. Creating a new schedule...');
    const createResponse = await axios.post(`${API_URL}/api/schedules`, {
      namespace: testNamespace,
      schedule: testSchedule
    });
    
    console.log('Create response status:', createResponse.status);
    testScheduleId = createResponse.data.id;
    console.log('Schedule created with ID:', testScheduleId);
    
    console.log('2. Getting all schedules...');
    const getResponse = await axios.get(`${API_URL}/api/schedules`);
    
    const createdSchedule = getResponse.data.find(s => s.id === testScheduleId);
    if (!createdSchedule) {
      throw new Error('Created schedule not found in the list of schedules');
    }
    
    console.log('Schedule found in the list:', createdSchedule.namespace);
    
    console.log('3. Deleting the schedule...');
    const deleteResponse = await axios.delete(`${API_URL}/api/schedules/${testScheduleId}`);
    
    console.log('Delete response status:', deleteResponse.status);
    
    console.log('4. Verifying the schedule was deleted...');
    const verifyResponse = await axios.get(`${API_URL}/api/schedules`);
    
    const deletedSchedule = verifyResponse.data.find(s => s.id === testScheduleId);
    if (deletedSchedule) {
      throw new Error('Schedule was not deleted successfully');
    }
    
    console.log('All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    process.exit(1);
  }
}

runTests();