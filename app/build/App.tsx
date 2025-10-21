import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from './lib/firebase';
import './App.css';

interface ConversionResult {
  success: boolean;
  originalFileName: string;
  convertedFileName: string;
  convertedContent: string; // Base64 encoded converted content
  sourceEncoding: string;
  message: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.name.endsWith('.sql')) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError('Please select a .sql file');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const convertFile = async () => {
    if (!file) return;

    setIsConverting(true);
    setError(null);
    setResult(null);

    try {
      // Read file content as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Convert to base64 for transmission
      const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Call the Firebase function
      const convertToUtf8 = httpsCallable(functions, 'convertToUtf8');

      const response = await convertToUtf8({
        fileName: file.name,
        fileContent: base64Content,
        // Let the function auto-detect encoding
      });

      setResult(response.data as ConversionResult);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Conversion failed';
      setError(errorMessage);
    } finally {
      setIsConverting(false);
    }
  };

  const downloadConvertedFile = () => {
    if (!result || !result.convertedContent) return;
    
    try {
      // Decode base64 content
      const binaryString = atob(result.convertedContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob and download
      const blob = new Blob([bytes], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = result.convertedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Failed to download converted file');
    }
  };

  return (
    <div className="min-h-screen min-w-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              SQL to UTF-8 Converter
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Convert your SQL files from any encoding to UTF-8 automatically
            </p>
          </div>

          {/* Upload Area */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600"
              } ${file ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-4">
                  <div className="text-6xl">✅</div>
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-6xl">📁</div>
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      Drop your SQL file here
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      or click to browse
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".sql"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
                  >
                    📄 Choose File
                  </label>
                </div>
              )}
            </div>

            {/* Convert Button */}
            {file && (
              <div className="mt-6 text-center">
                <button
                  onClick={convertFile}
                  disabled={isConverting}
                  className={`inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    isConverting ? "cursor-not-allowed" : ""
                  }`}
                >
                  {isConverting ? (
                    <>
                      <span className="mr-2">⏳</span>
                      Converting...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🔄</span>
                      Convert to UTF-8
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">⚠️</span>
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center mb-4">
                <span className="text-green-500 mr-2 text-2xl">✅</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Conversion Complete!
                </h3>
              </div>
              
              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Original file:</p>
                  <p className="font-medium text-gray-900 dark:text-white">{result.originalFileName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Detected encoding:</p>
                  <p className="font-medium text-gray-900 dark:text-white">{result.sourceEncoding}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Converted file:</p>
                  <p className="font-medium text-gray-900 dark:text-white">{result.convertedFileName}</p>
                </div>
              </div>

              <button
                onClick={downloadConvertedFile}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <span className="mr-2">⬇️</span>
                Download Converted File
              </button>
            </div>
          )}

          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Auto-Detection
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically detects the source encoding from 20+ formats
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Smart Conversion
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uses intelligent scoring to pick the best encoding match
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⬇️</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Easy Download
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get your UTF-8 converted file with a simple click
              </p>
            </div>
          </div>

          {/* Watermark/Credit */}
          <div className="mt-16 text-center">
            <p className="text-2xl text-gray-400 dark:text-gray-500">
              Created by{' '}
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Mityo Draganov
              </span>
            </p>
          </div>
      </div>
    </div>
  );
}

export default App;
