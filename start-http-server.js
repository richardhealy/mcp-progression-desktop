#!/usr/bin/env node

// Startup script for HTTP MCP Server
// This ensures the server starts with the correct environment and working directory

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting HTTP MCP Server...');
console.log('Working directory:', __dirname);

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found at', envPath);
  process.exit(1);
}

// Check if http-mcp-server.js exists
const serverPath = path.join(__dirname, 'http-mcp-server.js');
if (!fs.existsSync(serverPath)) {
  console.error('Error: http-mcp-server.js not found at', serverPath);
  process.exit(1);
}

// Start the HTTP server with explicit environment
const serverProcess = spawn('node', ['http-mcp-server.js'], {
  cwd: __dirname,
  stdio: 'inherit', // This will show output in the parent process
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

serverProcess.on('error', (error) => {
  console.error('Failed to start HTTP server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  console.log(`HTTP server exited with code ${code} and signal ${signal}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down HTTP server...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down HTTP server...');
  serverProcess.kill('SIGINT');
});

console.log('HTTP server startup script initialized'); 