const request = require('supertest');
const axios = require('axios');
const { Pool } = require('pg');

// Set required environment variables for the server
process.env.OKTETO_URL = process.env.OKTETO_URL || 'https://okteto.example.com';
process.env.OKTETO_TOKEN = process.env.OKTETO_TOKEN || 'dummy-token';

// Mock the Pool constructor and its query method
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

// Mock the initializeDatabase function to prevent it from running
jest.mock('../server', () => {
  const originalModule = jest.requireActual('../server');
  originalModule.initializeDatabase = jest.fn().mockResolvedValue();
  return originalModule;
});

// Import the server after mocking dependencies
const app = require('../server');

describe('Health Check Endpoint', () => {
  let pool;
  
  beforeEach(() => {
    // Get the mocked pool instance
    pool = new Pool();
    // Reset the mock before each test
    pool.query.mockReset();
  });

  afterAll(async () => {
    // Close the server after all tests
    await new Promise(resolve => setTimeout(resolve, 500));
    process.exit(0);
  });

  test('should return 200 and healthy status when database is connected', async () => {
    // Mock the database query to return a successful result
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('database', 'connected');
    expect(response.body).toHaveProperty('timestamp');
    
    // Verify that the database query was called with the correct SQL
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  test('should return 500 and unhealthy status when database query returns unexpected result', async () => {
    // Mock the database query to return an unexpected result
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 0 }] });

    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body).toHaveProperty('database', 'error');
    expect(response.body).toHaveProperty('message', 'Database query returned unexpected result');
  });

  test('should return 500 and unhealthy status when database connection fails', async () => {
    // Mock the database query to throw an error
    const errorMessage = 'Connection refused';
    pool.query.mockRejectedValueOnce(new Error(errorMessage));

    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body).toHaveProperty('database', 'disconnected');
    expect(response.body).toHaveProperty('error', errorMessage);
  });
});

// Integration test for the actual endpoint
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
      const response = await axios.get(`${baseUrl}/api/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('database', 'connected');
      expect(response.data).toHaveProperty('timestamp');
    } catch (error) {
      console.error('Integration test failed:', error.message);
      throw error;
    }
  });
});