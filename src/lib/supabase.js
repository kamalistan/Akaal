import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function callEdgeFunction(functionName, payload = {}, options = {}) {
  const method = options.method || 'POST';
  const params = options.params || {};

  // Build URL with query params for GET requests
  let url = `${supabaseUrl}/functions/v1/${functionName}`;
  if (method === 'GET' && Object.keys(params).length > 0) {
    // Filter out null/undefined values to avoid sending "null" as string
    const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
    const searchParams = new URLSearchParams(filteredParams);
    url += `?${searchParams.toString()}`;
  }

  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  };

  // Only add body for non-GET requests
  if (method !== 'GET' && Object.keys(payload).length > 0) {
    fetchOptions.body = JSON.stringify(payload);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Edge function error: ${error}`);
  }

  return response.json();
}
