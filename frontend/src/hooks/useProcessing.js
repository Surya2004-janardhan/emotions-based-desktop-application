import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

export default function useProcessing() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const startPolling = useCallback((jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`/status?job_id=${encodeURIComponent(jobId)}`);
        setProgress(data.progress || 0);
        setStatus(data.status || '');
        if (data.progress >= 100) {
          clearInterval(pollRef.current);
        }
      } catch {
        // silently continue polling
      }
    }, 600);
  }, []);

  const processVideo = useCallback(async (blob) => {
    setIsProcessing(true);
    setProgress(0);
    setStatus('Uploading...');
    setResults(null);
    setError(null);

    const jobId = globalThis.crypto?.randomUUID?.() || `job-${Date.now()}`;
    const formData = new FormData();
    formData.append('video', blob, 'recording.webm');
    formData.append('job_id', jobId);

    startPolling(jobId);

    try {
      const { data } = await axios.post('/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

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
    setProgress(0);
    setStatus('Uploading...');
    setResults(null);
    setError(null);

    const jobId = globalThis.crypto?.randomUUID?.() || `job-${Date.now()}`;
    const formData = new FormData();
    formData.append('video', file);
    formData.append('job_id', jobId);

    startPolling(jobId);

    try {
      const { data } = await axios.post('/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

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
    setProgress(0);
    setStatus('');
    setIsProcessing(false);
    setResults(null);
    setError(null);
  }, []);

  return {
    progress,
    status,
    isProcessing,
    results,
    error,
    processVideo,
    processFile,
    reset,
  };
}
