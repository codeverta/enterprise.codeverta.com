// src/test-setup.ts (atau bisa digabung ke setupTests.ts)
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Establish API mocking before all tests.
beforeAll(() => server.listen());

// Reset any request handlers that are declared as a part of our tests
// (i.e. for testing one-off error cases).
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());