#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import https from 'node:https';
import { z } from 'zod';
import Airtable from 'airtable';

const app = express();
const PORT = process.env.PORT || 8087; // Use unique port to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());

// Setup logging
const logFile = fs.createWriteStream('http-mcp-server.log', { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logFile.write(`${logMessage}\n`);
}

// Environment variable handling
const apiKey = process.env.ANTHROPIC_API_KEY;
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
const airtableTableName = process.env.AIRTABLE_TABLE_NAME || 'Progress Items';
const fullName = process.env.USER_FULL_NAME || 'User';

if (!apiKey) {
  log('Warning: ANTHROPIC_API_KEY environment variable is not set');
}

if (!airtableApiKey || !airtableBaseId) {
  log('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables must be set');
  process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);
const table = base(airtableTableName);

// Airtable helper functions
async function saveToAirtable(item) {
  try {
    const validProjects = ['GGSA', 'Nestly', 'Seenspire'];
    const project = validProjects.includes(item.project) ? item.project : 'GGSA';
    
    const recordData = {
      'Hours': item.hours,
      'Description': item.description,
      'Project': project,
      'Created At': Date.now(),
      'Date': item.date.toISOString()
    };

    const record = await table.create(recordData);
    log(`Saved progress item to Airtable: ${record.id}`);
    return record;
  } catch (error) {
    log(`Error saving to Airtable: ${error.message}`);
    throw error;
  }
}

async function getFromAirtable(date) {
  try {
    const records = await table.select({
      sort: [{ field: 'Created At', direction: 'desc' }]
    }).all();
    
    return records.map(record => ({
      hours: record.get('Hours'),
      description: record.get('Description'),
      date: new Date(record.get('Date')) || new Date(),
      project: record.get('Project'),
      id: record.id
    }));
  } catch (error) {
    log(`Error fetching from Airtable: ${error.message}`);
    throw error;
  }
}

function formatDate(date) {
  const pad = (number) => number < 10 ? `0${number}` : number.toString();
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Claude API helper function
function callClaude(prompt) {
  if (!apiKey) {
    return Promise.resolve(prompt); // Return original if no API key
  }
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "claude-3-haiku-20240307", // Using cheaper model for HTTP server
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    });
    
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (parsedData.content && parsedData.content.length > 0) {
            resolve(parsedData.content[0].text);
          } else {
            resolve(prompt);
          }
        } catch (e) {
          log(`Error parsing Claude API response: ${e}`);
          resolve(prompt);
        }
      });
    });
    
    req.on('error', (e) => {
      log(`Error calling Claude API: ${e}`);
      resolve(prompt);
    });
    
    req.write(data);
    req.end();
  });
}

// API Routes
app.post('/add-progress', async (req, res) => {
  try {
    const { hours, description, date, project = 'GGSA' } = req.body;
    
    if (!hours || !description || !date) {
      return res.status(400).json({ 
        error: 'Missing required fields: hours, description, date' 
      });
    }

    const item = {
      hours: parseFloat(hours),
      description,
      date: new Date(date),
      project
    };

    await saveToAirtable(item);
    
    res.json({
      success: true,
      message: `Progress item added: ${hours}h - ${description} (${project})`
    });
  } catch (error) {
    log(`Error adding progress: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/progress-report', async (req, res) => {
  try {
    const { date } = req.query;
    const progressDate = date ? new Date(date) : new Date();
    
    const items = await getFromAirtable(progressDate);
    const dateString = formatDate(progressDate);
    const title = `${fullName} - Daily Update - ${dateString}`;
    
    let content = `${title}\n\n`;
    
    if (items.length > 0) {
      content += "Today's production\n";
      for (const item of items) {
        const hoursText = item.hours === 1 ? '- 1h' : `- ${item.hours}h`;
        content += `${hoursText}: ${item.description}\n`;
      }
    } else {
      content += "No items for today.\n";
    }
    
    const report = await callClaude(`Please format the following progress update in a professional and clear way, maintaining the same structure where times appear first (e.g., "2h: Task description"). Keep the sections as they are:\n\n${content}`);
    
    res.json({
      success: true,
      report,
      rawItems: items
    });
  } catch (error) {
    log(`Error getting progress report: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Handle browser extension progress reports
app.post('/progress-report', async (req, res) => {
  try {
    const { content, timestamp, project = 'GGSA' } = req.body;
    
    // Parse hours and description from the content
    // This is a simplified parser - you might want to make it more robust
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.includes(':')) {
        // Try to extract hours and description
        const match = line.match(/(\d+(?:\.\d+)?)h?\s*:\s*(.+)/);
        if (match) {
          const hours = parseFloat(match[1]);
          const description = match[2].trim();
          
          await saveToAirtable({
            hours,
            description,
            date: new Date(timestamp),
            project
          });
        } else {
          // If no hours specified, assume 1 hour
          await saveToAirtable({
            hours: 1,
            description: line.trim(),
            date: new Date(timestamp),
            project
          });
        }
      } else {
        // If no colon, assume 1 hour
        await saveToAirtable({
          hours: 1,
          description: line.trim(),
          date: new Date(timestamp),
          project
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Progress report processed and saved' 
    });
  } catch (error) {
    log(`Error processing progress report: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'HTTP MCP Progress Server'
  });
});

app.listen(PORT, () => {
  log(`HTTP MCP Progress Server running on port ${PORT}`);
  log('Available endpoints:');
  log('  POST /add-progress - Add a progress item');
  log('  GET /progress-report - Get formatted progress report');
  log('  POST /progress-report - Process browser extension report');
  log('  GET /health - Health check');
}); 