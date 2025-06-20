#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

// ESM-compatible server file
import fs from 'node:fs';
import https from 'node:https';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import Airtable from 'airtable';

// Setup logging
const logFile = fs.createWriteStream('mcp-server.log', { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  // Write to stderr for Claude to capture logs
  console.error(logMessage);
  // Also write to log file
  logFile.write(`${logMessage}\n`);
}

// Log basic info
log('===== STARTING ESM SERVER =====');
log(`Node.js version: ${process.version}`);
log(`Process ID: ${process.pid}`);
log(`Current directory: ${process.cwd()}`);

// Environment variable handling
const apiKey = process.env.ANTHROPIC_API_KEY;
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
const airtableTableName = process.env.AIRTABLE_TABLE_NAME || 'Progress Items';
const fullName = process.env.USER_FULL_NAME || 'User';

if (!apiKey) {
  log('Error: ANTHROPIC_API_KEY environment variable is not set');
  process.exit(1);
}

if (!airtableApiKey || !airtableBaseId) {
  log('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables must be set');
  process.exit(1);
}

log('Environment variables loaded successfully');

// Initialize Airtable
const base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);
const table = base(airtableTableName);

// Airtable helper functions
async function saveToAirtable(item) {
  try {
    // Validate project value against allowed values
    const validProjects = ['GGSA', 'Nestly', 'Seenspire'];
    const project = validProjects.includes(item.project) ? item.project : 'GGSA';
    
    // Debug the project value
    log(`Project value being sent to Airtable: "${JSON.stringify(item)}"`);
    
    // Create a record object with all fields - using the correct column names
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
    // We don't filter by date anymore since there's no Date field
    const records = await table.select({
      sort: [{ field: 'Created At', direction: 'desc' }] // Using Airtable's built-in Created At field
    }).all();
    
    // Map the records to our internal format
    return records.map(record => ({
      hours: record.get('Hours'),
      description: record.get('Description'),
      date: new Date(), // Using current date since we don't have a date field
      id: record.id
    }));
  } catch (error) {
    log(`Error fetching from Airtable: ${error.message}`);
    throw error;
  }
}

// Replace in-memory storage with Airtable
const progressItems = {
  async add(item) {
    await saveToAirtable(item);
  },
  
  async getForDate(date) {
    return await getFromAirtable(date);
  }
};

// Helper functions
function formatDate(date) {
  const pad = (number) => number < 10 ? `0${number}` : number.toString();
  
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}


// Claude API helper function (without using the SDK)
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [
        {
          role: "user", 
          content: prompt
        }
      ]
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
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (parsedData.content && parsedData.content.length > 0) {
            resolve(parsedData.content[0].text);
          } else {
            resolve(prompt); // Fallback to original text
          }
        } catch (e) {
          log(`Error parsing Claude API response: ${e}`);
          resolve(prompt); // Fallback to original text
        }
      });
    });
    
    req.on('error', (e) => {
      log(`Error calling Claude API: ${e}`);
      resolve(prompt); // Fallback to original text
    });
    
    req.write(data);
    req.end();
  });
}

// Create the MCP server with the proper class
log('Creating MCP server...');
const server = new McpServer({
  name: 'daily-progress-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define the tools
server.tool('add_progress',
  'Add a progress item for a specific date',
  {
    hours: z.number().describe('Number of hours spent on the task'),
    description: z.string().describe('Description of the progress'),
    date: z.string().describe('ISO date string for when this progress occurred'),
    project: z.enum(['GGSA', 'Nestly', 'Seenspire']).default('GGSA').describe('Project name (GGSA, Nestly, or Seenspire)')
  },
  async (params) => {
    const hours = params.hours;
    const description = params.description;
    const date = new Date(params.date);
    const project = params.project || 'GGSA';
    
    log(`Adding progress item: ${hours}h - ${description} for ${date.toISOString().split('T')[0]} (Project: ${project})`);
    
    const item = {
      hours,
      description,
      date,
      project
    };
    
    try {
      await progressItems.add(item);
      return {
        content: [{
          type: 'text',
          text: `Progress item added successfully: ${hours}h - ${description} for ${date.toISOString().split('T')[0]} (Project: ${project})`
        }]
      };
    } catch (error) {
      log(`Error adding progress item: ${error.message}`);
      return {
        content: [{
          type: 'text',
          text: `Error adding progress item: ${error.message}`
        }]
      };
    }
  }
);

server.tool('get_progress',
  'Get progress report for a date',
  {
    date: z.string().optional().describe('ISO date string (optional)')
  },
  async (params) => {
    const progressDate = params.date ? new Date(params.date) : new Date();
    log(`Getting progress for date: ${progressDate}`);
    
    try {
      const itemsForDay = await progressItems.getForDate(progressDate);
      const todayItems = itemsForDay.filter(item => !item.isTomorrow);
      const tomorrowItems = itemsForDay.filter(item => item.isTomorrow);
      
      const dateString = formatDate(progressDate);
      const title = `${fullName} - Daily Update - ${dateString}`;
      
      let content = `${title}\n\n`;
      
      if (todayItems.length > 0) {
        content += "Today's production\n";
        for (const item of todayItems) {
          const hoursText = item.hours === 1 ? '- 1h' : `- ${item.hours}h`;
          content += `${hoursText}: ${item.description}\n`;
        }
        content += '\n';
      } else {
        content += "No items for today.\n\n";
      }
      
      if (tomorrowItems.length > 0) {
        content += "Tomorrow's production\n";
        for (const item of tomorrowItems) {
          const hoursText = item.hours === 1 ? '- 1h' : `- ${item.hours}h`;
          content += `${hoursText}: ${item.description}\n`;
        }
      }
      
      const report = await callClaude(`Please format the following progress update in a professional and clear way, maintaining the same structure where times appear first (e.g., "2h: Task description"). Keep the sections as they are:\n\n${content}`);
      log(`Got formatted report, length: ${report.length}`);
      
      return {
        content: [{
          type: 'text',
          text: report
        }]
      };
    } catch (error) {
      log(`Error getting progress: ${error.message}`);
      return {
        content: [{
          type: 'text',
          text: `Error getting progress: ${error.message}`
        }]
      };
    }
  }
);

// Start the server using stdio transport
log('Starting server with stdio transport...');
const transport = new StdioServerTransport();

try {
  // Connect the server to the transport
  await server.connect(transport);
  log('Server started successfully');
  
  // Keep the process running with heartbeat
  setInterval(() => {
    log('Server heartbeat - still alive');
  }, 30000);
} catch (error) {
  log(`Failed to start server: ${error.message}`);
  process.exit(1);
}

// Process lifecycle handling
process.on('SIGINT', () => {
  log('Server shutting down (SIGINT)');
  server.close().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  log('Server shutting down (SIGTERM)');
  server.close().then(() => process.exit(0));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.stack}`);
  // Don't exit, just log
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  // Don't exit, just log
});