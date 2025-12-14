import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "69362019c948a71a6da8cddc", 
  requiresAuth: true // Ensure authentication is required for all operations
});
