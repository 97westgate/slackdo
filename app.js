require('dotenv').config();
const { App } = require('@slack/bolt');
const OpenAI = require('openai');
const stringSimilarity = require('string-similarity');
const { formatDate, formatTask } = require('./formatter');
const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const { WebSocket } = require('ws');

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store todos in memory
const todos = [];

// Add a cache for user and channel names
const nameCache = {
  users: {},
  channels: {}
};

// Function to resolve names
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

// API endpoint to get todos
expressApp.get('/api/todos', (req, res) => {
    res.json(todos);
});

// API endpoint to resolve references
expressApp.get('/api/resolve-references', async (req, res) => {
  try {
    const userCache = {};
    const channelCache = {};
    
    for (const todo of todos) {
      const userId = todo.user.match(/<@([A-Z0-9]+)>/)[1];
      const channelId = todo.channel.match(/<#([A-Z0-9]+)>/)[1];
      
      if (!userCache[userId]) {
        const userInfo = await slackApp.client.users.info({ user: userId });
        userCache[userId] = userInfo.user.real_name || userInfo.user.name;
      }
      
      if (!channelCache[channelId]) {
        const channelInfo = await slackApp.client.conversations.info({ channel: channelId });
        channelCache[channelId] = channelInfo.channel.name;
      }
    }
    
    res.json({ users: userCache, channels: channelCache });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create HTTP server
const server = http.createServer(expressApp);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Track connected clients
const clients = new Set();

// Function to convert old todo format to new format
async function convertTodo(todo) {
    console.log('Converting todo:', todo);
    
    // If todo is already in new format, return as is
    if (todo.user && typeof todo.user === 'object') {
        console.log('Todo already in new format');
        return todo;
    }

    try {
        // Extract IDs from the old format
        const userMatch = todo.user.match(/<@([A-Z0-9]+)>/);
        const channelMatch = todo.channel.match(/<#([A-Z0-9]+)>/);
        
        if (!userMatch || !channelMatch) {
            console.error('Failed to extract IDs:', { user: todo.user, channel: todo.channel });
            return todo;
        }

        const userId = userMatch[1];
        const channelId = channelMatch[1];
        
        console.log('Extracted IDs:', { userId, channelId });

        // Resolve names
        const userName = await resolveName(userId, 'user');
        const channelName = await resolveName(channelId, 'channel');
        
        console.log('Resolved names:', { userName, channelName });

        // Return todo in new format
        return {
            ...todo,
            user: {
                id: userId,
                name: userName
            },
            channel: {
                id: channelId,
                name: channelName
            }
        };
    } catch (error) {
        console.error('Error converting todo:', error);
        return todo;
    }
}

// Update WebSocket connection handler
wss.on('connection', async (ws) => {
    console.log('New client connected!');
    clients.add(ws);
    
    // Convert all todos to new format before sending
    const convertedTodos = await Promise.all(todos.map(convertTodo));
    
    const message = JSON.stringify({
        type: 'todos',
        data: convertedTodos
    });
    console.log('Sending initial todos:', message);
    ws.send(message);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Update broadcast function
async function broadcastTodos() {
    const convertedTodos = await Promise.all(todos.map(convertTodo));
    const message = JSON.stringify({
        type: 'todos',
        data: convertedTodos
    });
    console.log('Broadcasting todos:', message);
    
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
    await slackApp.start();
    server.listen(3000, () => {
      console.log('⚡️ Slack bot and frontend running on http://localhost:3000');
      console.log('Current todos:', todos);
    });
  } catch (error) {
    console.error('❌ Error starting servers:', error);
  }
})();