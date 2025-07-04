// Embedded HTTP Server for MCP Progress Tracker
// This runs directly in the Electron main process to ensure it always starts

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import https from 'node:https';
import Airtable from 'airtable';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server = null;
let isServerRunning = false;

// Setup logging - use userData directory for writable logs
const getLogPath = () => {
  try {
    // In packaged app, use userData directory
    return path.join(app.getPath('userData'), 'embedded-server.log');
  } catch (error) {
    // Fallback for development
    return path.join(__dirname, 'embedded-server.log');
  }
};

let logFile = null;

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Initialize log file if not already done
  if (!logFile) {
    try {
      const logPath = getLogPath();
      // Ensure the directory exists
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      logFile = fs.createWriteStream(logPath, { flags: 'a' });
    } catch (error) {
      console.error('Failed to create log file:', error);
      return; // Skip writing to file if it fails
    }
  }
  
  try {
    logFile.write(`${logMessage}\n`);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

// Load environment variables from .env file
function loadEnvVars() {
  // Try multiple locations for .env file
  const envPaths = [
    path.join(__dirname, '.env'), // Development location
    path.join(process.cwd(), '.env'), // Current working directory
  ];
  
  // In packaged app, also try userData directory
  try {
    envPaths.push(path.join(app.getPath('userData'), '.env'));
    envPaths.push(path.join(app.getPath('exe'), '..', '.env')); // Near executable
  } catch (error) {
    // Ignore if app not available
  }
  
  log(`Checking for .env file in ${envPaths.length} locations...`);
  
  for (const envPath of envPaths) {
    log(`Checking: ${envPath}`);
    if (fs.existsSync(envPath)) {
      log(`Loading environment variables from: ${envPath}`);
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        let loadedVars = 0;
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=');
            if (key && value) {
              process.env[key] = value;
              loadedVars++;
            }
          }
        }
        
        log(`Successfully loaded ${loadedVars} environment variables`);
        return; // Stop after loading the first found .env file
      } catch (error) {
        log(`Error reading .env file ${envPath}: ${error.message}`);
      }
    }
  }
  
  log('No .env file found in any of the expected locations');
  log('Available environment variables:');
  log(`AIRTABLE_API_KEY: ${process.env.AIRTABLE_API_KEY ? 'SET' : 'NOT SET'}`);
  log(`AIRTABLE_BASE_ID: ${process.env.AIRTABLE_BASE_ID ? 'SET' : 'NOT SET'}`);
}

export function startEmbeddedServer() {
  if (isServerRunning) {
    log('Server is already running');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      // Load environment variables
      loadEnvVars();

      const app = express();
      const PORT = 8087;

      // Middleware
      app.use(cors());
      app.use(express.json());

      // Environment variable handling
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const airtableApiKey = process.env.AIRTABLE_API_KEY;
      const airtableBaseId = process.env.AIRTABLE_BASE_ID;
      const airtableTableName = process.env.AIRTABLE_TABLE_NAME || 'Progress Items';
      const fullName = process.env.USER_FULL_NAME || 'User';

      if (!airtableApiKey || !airtableBaseId) {
        const error = 'AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables must be set';
        log(`Error: ${error}`);
        log('Available environment variables:');
        log(`AIRTABLE_API_KEY: ${airtableApiKey ? 'SET' : 'NOT SET'}`);
        log(`AIRTABLE_BASE_ID: ${airtableBaseId ? 'SET' : 'NOT SET'}`);
        log(`AIRTABLE_TABLE_NAME: ${airtableTableName}`);
        
        // Check if variables exist but are empty
        if (process.env.AIRTABLE_API_KEY === '') {
          log('AIRTABLE_API_KEY is empty string');
        }
        if (process.env.AIRTABLE_BASE_ID === '') {
          log('AIRTABLE_BASE_ID is empty string');
        }
        
        reject(new Error(error));
        return;
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

      async function getFromAirtable() {
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

      // AI Planning function
      async function generateAIPlan(project, goals, workPattern, workingDays, apiKey) {
        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const selectedDays = workingDays.map(day => dayNames[day]).join(', ');
        
        const prompt = `You are an AI project planning assistant. I need you to create a detailed weekly work plan for a software development project.

PROJECT: ${project}
WEEKLY GOALS: ${goals}
WORK PATTERN: ${workPattern} hours per day
WORKING DAYS: ${selectedDays}

Please analyze the goals and create a realistic weekly plan with specific, actionable tasks. Each task should:
1. Be directly related to achieving the stated goals
2. Have a realistic time estimate (0.5h to 3h chunks)
3. Be scheduled with appropriate breaks between longer tasks
4. Build logically on previous tasks

For each working day, provide 2-4 tasks that add up to ${workPattern} hours total. Tasks should be:
- Specific and actionable (not vague like "work on feature")
- Technically realistic for software development
- Properly sequenced (research before implementation, testing after coding, etc.)
- Include variety (coding, testing, documentation, planning, etc.)

Return your response as a JSON object with this exact structure:
{
  "project": "${project}",
  "totalHours": ${workingDays.length * workPattern},
  "totalDays": ${workingDays.length},
  "workPattern": ${workPattern},
  "tasks": [
    {
      "id": "task-1",
      "title": "Specific task title",
      "hours": 2.5,
      "dayName": "Monday",
      "date": "2024-01-15",
      "startTime": "09:00",
      "endTime": "11:30",
      "description": "Detailed description of what this task involves"
    }
  ]
}

Calculate dates for the current week starting from Monday. Include realistic start/end times with breaks. Make sure tasks are genuinely relevant to the stated goals and technically sound.`;

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 4000,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ]
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${errorData}`);
          }

          const data = await response.json();
          const content = data.content[0].text;
          
          // Extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No valid JSON found in AI response');
          }
          
          const plan = JSON.parse(jsonMatch[0]);
          
          // Add proper dates for current week
          const currentDate = new Date();
          const startOfWeek = new Date(currentDate);
          startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Start from Monday
          
          plan.tasks.forEach((task, index) => {
            const dayIndex = workingDays[Math.floor(index / Math.ceil(plan.tasks.length / workingDays.length))];
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + dayIndex - 1);
            task.date = date.toISOString().split('T')[0];
          });
          
          log(`AI plan generated successfully with ${plan.tasks.length} tasks`);
          return plan;
          
        } catch (error) {
          log(`Error calling Anthropic API: ${error.message}`);
          throw new Error(`Failed to generate AI plan: ${error.message}`);
        }
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
          const items = await getFromAirtable();
          
          res.json({
            success: true,
            rawItems: items
          });
        } catch (error) {
          log(`Error getting progress report: ${error.message}`);
          res.status(500).json({ error: error.message });
        }
      });

      // AI Planning endpoint
      app.post('/generate-plan', async (req, res) => {
        try {
          const { project, goals, workPattern, workingDays } = req.body;
          
          if (!project || !goals || !workPattern || !workingDays) {
            return res.status(400).json({ 
              error: 'Missing required fields: project, goals, workPattern, workingDays' 
            });
          }

          if (!apiKey) {
            return res.status(500).json({ 
              error: 'ANTHROPIC_API_KEY environment variable not set' 
            });
          }

          log(`Generating AI plan for project: ${project}`);
          
          const plan = await generateAIPlan(project, goals, workPattern, workingDays, apiKey);
          
          res.json({
            success: true,
            plan: plan
          });
        } catch (error) {
          log(`Error generating AI plan: ${error.message}`);
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          server: 'Embedded MCP Progress Server',
          port: PORT
        });
      });

      // Start the server
      server = app.listen(PORT, 'localhost', () => {
        isServerRunning = true;
        log(`Embedded MCP Progress Server running on port ${PORT}`);
        log('Available endpoints:');
        log('  POST /add-progress - Add a progress item');
        log('  GET /progress-report - Get progress items');
        log('  POST /generate-plan - Generate AI weekly plan');
        log('  GET /health - Health check');
        resolve();
      });

      server.on('error', (error) => {
        log(`Server error: ${error.message}`);
        isServerRunning = false;
        reject(error);
      });

    } catch (error) {
      log(`Failed to start embedded server: ${error.message}`);
      reject(error);
    }
  });
}

export function stopEmbeddedServer() {
  return new Promise((resolve) => {
    if (server && isServerRunning) {
      server.close(() => {
        isServerRunning = false;
        log('Embedded server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function isServerHealthy() {
  return isServerRunning;
} 