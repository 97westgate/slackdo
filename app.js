require('dotenv').config();
const { App } = require('@slack/bolt');
const OpenAI = require('openai');
const express = require('express');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const { formatDate, formatTask } = require('./formatter');

// Initialize Express
const expressApp = express();
expressApp.use(express.static('public'));

// Initialize Slack app
const slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
});

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Store todos in memory
const todos = [];

// Name cache for users and channels
const nameCache = {
    users: {},
    channels: {}
};

// Create HTTP server
const server = http.createServer(expressApp);

// Create WebSocket server for frontend
const wss = new WebSocketServer({ server });

// Track connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected!');
    clients.add(ws);
    
    // Send current todos
    const message = JSON.stringify({
        type: 'todos',
        data: todos
    });
    ws.send(message);

    // Handle status toggle messages
    ws.on('message', async (data) => {
        console.log('Received WebSocket message:', data.toString()); // Debug log
        try {
            const message = JSON.parse(data);
            console.log('Parsed message:', message); // Debug log
            
            if (message.type === 'toggleStatus') {
                console.log('Looking for todo with timestamp:', message.timestamp); // Debug log
                console.log('Current todos:', todos); // Debug log
                
                const todo = todos.find(t => t.timestamp === message.timestamp);
                if (todo) {
                    console.log('Found todo, current status:', todo.status); // Debug log
                    todo.status = todo.status === 'completed' ? null : 'completed';
                    console.log('New status:', todo.status); // Debug log
                    broadcastTodos();
                } else {
                    console.log('Todo not found!'); // Debug log
                }
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Broadcast todos to all clients
function broadcastTodos() {
    const message = JSON.stringify({
        type: 'todos',
        data: todos
    });
    console.log('Broadcasting todos:', message); // Debug log
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Add a test todo for debugging
todos.push({
  task: "Test todo",
  deadline: null,
  user: {
    id: "U12345678",
    name: "Test User"
  },
  channel: {
    id: "C12345678",
    name: "test-channel"
  },
  timestamp: new Date().toISOString(),
  status: null
});

// Add near the top with other constants
const SIMILARITY_THRESHOLD = 0.8;
const recentTodos = new Set();

// Add the duplicate detection function
function isSimilarToExisting(newTodo) {
  const newTodoLower = newTodo.toLowerCase();
  for (const existingTodo of recentTodos) {
    const similarity = stringSimilarity.compareTwoStrings(newTodoLower, existingTodo);
    if (similarity > SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

// Add name resolution function
async function resolveName(id, type) {
    console.log(`Resolving ${type} name for ID:`, id);
    try {
        if (type === 'user') {
            if (!nameCache.users[id]) {
                console.log('Fetching user info from Slack API...');
                const result = await slackApp.client.users.info({ user: id });
                nameCache.users[id] = result.user.real_name || result.user.name;
                console.log('Resolved user name:', nameCache.users[id]);
            }
            return nameCache.users[id];
        } else {
            if (!nameCache.channels[id]) {
                console.log('Fetching channel info from Slack API...');
                const result = await slackApp.client.conversations.info({ channel: id });
                nameCache.channels[id] = result.channel.name;
                console.log('Resolved channel name:', nameCache.channels[id]);
            }
            return nameCache.channels[id];
        }
    } catch (error) {
        console.error(`Error resolving ${type} name for ${id}:`, error);
        return id;
    }
}

slackApp.message(async ({ message, client }) => {
  process.stdout.write(`Analyzing message: ${message.text}\n`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-0613",
      messages: [{
        role: "system",
        content: "You are a task detector. Respond with only 'yes' or 'no'."
      }, {
        role: "user",
        content: `Is this message a task or todo item? Consider action items, future tasks, assignments, deadlines, and responsibilities. Message: "${message.text}"`
      }],
      max_tokens: 60,
      temperature: 0.3,
    });

    if (completion.choices[0].message.content.trim().toLowerCase().includes('yes')) {
      process.stdout.write('🎯 Todo item detected!\n');
      
      // Parse the todo details
      const parseCompletion = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [{
          role: "system",
          content: `Extract the core task, deadline, and assignee from the message. For deadlines:
          - Convert relative dates to specific dates
          - Include time if mentioned
          - For rough deadlines, be specific
          
          Respond in JSON format: {"task": "core task", "deadline": "formatted date or null", "assignee": "assignee or null"}`
        }, {
          role: "user",
          content: message.text
        }],
        max_tokens: 150,
        temperature: 0.3,
      });

      const todoDetails = JSON.parse(parseCompletion.choices[0].message.content);
      
      // Format the task and deadline
      const formattedTask = formatTask(todoDetails.task);
      const formattedDeadline = formatDate(todoDetails.deadline);

      // Check for duplicates
      if (isSimilarToExisting(formattedTask)) {
        process.stdout.write('⚠️ Duplicate todo detected, skipping...\n');
        return;
      }

      // When creating a new todo, resolve names first
      const userId = message.user;
      const channelId = message.channel;
      const userName = await resolveName(userId, 'user');
      const channelName = await resolveName(channelId, 'channel');

      // Create todo with formatted values
      todos.push({
        task: formattedTask,
        deadline: formattedDeadline,
        user: {
          id: userId,
          name: userName
        },
        channel: {
          id: channelId,
          name: channelName
        },
        timestamp: new Date().toISOString(),
        status: null
      });

      // Add to recent todos for duplicate checking
      recentTodos.add(formattedTask.toLowerCase());
      
      setTimeout(() => {
        recentTodos.delete(formattedTask.toLowerCase());
      }, 24 * 60 * 60 * 1000);

      process.stdout.write('✅ Todo added to frontend\n');
      broadcastTodos();
    }
  } catch (error) {
    process.stdout.write(`❌ Error: ${error}\n`);
  }
});

// Start the servers
(async () => {
    try {
        // Start Slack app first
        await slackApp.start();
        console.log('⚡️ Slack bot is running!');

        // Then start HTTP/WebSocket server
        server.listen(3000, () => {
            console.log('💻 Frontend running on http://localhost:3000');
        });
    } catch (error) {
        console.error('❌ Error starting servers:', error);
    }
})();