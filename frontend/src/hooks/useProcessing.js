import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

export default function useProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const startPolling = useCallback((jobId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/progress/${jobId}`);
        const data = res.data || {};
        setProgress(data.progress || 0);
        setStatus(data.status || 'Processing...');
      } catch {
        // Ignore polling hiccups and keep waiting for the final response.
      }
    }, 700);
  }, []);

  const processVideo = useCallback(async (blob) => {
    setIsProcessing(true);
    setError('');
    setResults(null);
    setProgress(0);
    setStatus('Uploading...');

    try {
      const formData = new FormData();
      formData.append('video', blob, 'capture.webm');

      const startRes = await axios.post('/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = startRes.data || {};
      if (data.job_id) startPolling(data.job_id);

      clearInterval(pollRef.current);

      if (data.error) {
        setError(data.error);
        return null;
      } else {
        setResults(data);
        setProgress(100);
        setStatus('Complete');
        return data;
      }
    } catch (err) {
      clearInterval(pollRef.current);
      setError(err.response?.data?.error || err.message || 'Processing failed');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [startPolling]);

  const processFile = useCallback(async (file) => {
    setIsProcessing(true);
    setError('');
    setResults(null);
    setProgress(0);
    setStatus('Uploading...');

    try {
      const formData = new FormData();
      formData.append('video', file);

      const startRes = await axios.post('/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = startRes.data || {};
      if (data.job_id) startPolling(data.job_id);

      clearInterval(pollRef.current);

      if (data.error) {
        setError(data.error);
        return null;
      } else {
        setResults(data);
        setProgress(100);
        setStatus('Complete');
        return data;
      }
    } catch (err) {
      clearInterval(pollRef.current);
      setError(err.response?.data?.error || err.message || 'Processing failed');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [startPolling]);

  const reset = useCallback(() => {
    clearInterval(pollRef.current);
    setIsProcessing(false);
    setProgress(0);
    setStatus('Ready');
    setResults(null);
    setError('');
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
    };
  }, []);

  return {
    isProcessing,
    progress,
    status,
    results,
    error,
    processVideo,
    processFile,
    reset,
  };
}
