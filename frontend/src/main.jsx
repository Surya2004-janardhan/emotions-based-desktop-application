import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'
import { getBackendUrl } from './hooks/useBackendUrl.js'

// Resolve backend URL (HF Space in production, localhost in dev)
// then mount the app — ensures all axios calls use the right base
getBackendUrl().then(url => {
  axios.defaults.baseURL = url;
  console.log('[EmotionAI] Backend URL:', url);
  createRoot(document.getElementById('root')).render(<App />);
});
