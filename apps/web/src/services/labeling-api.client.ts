import axios from 'axios';

const baseURL = import.meta.env.VITE_LABELING_API_URL || '/labeling-api';

export const labelingApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

labelingApi.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_LABELING_API_KEY;
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  return config;
});
