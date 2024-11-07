require('dotenv').config();
const { App } = require('@slack/bolt');
const OpenAI = require('openai');
const stringSimilarity = require('string-similarity');
const { formatDate } = require('./dateFormatter');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SIMILARITY_THRESHOLD = 0.8; // Adjust this value (0-1) to control how similar todos need to be to be considered duplicates

// Keep track of recent todos to check for duplicates
const recentTodos = new Set();

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

app.message(async ({ message, client }) => {
  process.stdout.write(`Analyzing message: ${message.text}\n`);
  
  try {
    // First check if it's a todo
    const isTaskCompletion = await openai.chat.completions.create({
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

    if (isTaskCompletion.choices[0].message.content.trim().toLowerCase().includes('yes')) {
      process.stdout.write('🎯 Todo item detected!\n');
      
      // Parse the todo details
      const parseCompletion = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [{
          role: "system",
          content: `Extract the core task, deadline, and assignee from the message. For deadlines:
          - Convert relative dates to specific dates (e.g., "tomorrow" → "January 31, 2024")
          - Include time if mentioned
          - For rough deadlines, be specific (e.g., "before election" → "before November 5, 2024")
          
          Respond in JSON format: {"task": "core task", "deadline": "formatted date or null", "assignee": "assignee or null"}`
        }, {
          role: "user",
          content: message.text
        }],
        max_tokens: 150,
        temperature: 0.3,
      });

      const todoDetails = JSON.parse(parseCompletion.choices[0].message.content);
      
      // Check for duplicates
      if (isSimilarToExisting(todoDetails.task)) {
        process.stdout.write('⚠️ Duplicate todo detected, skipping...\n');
        return;
      }

      // Format the message with cleaner deadline
      let todoText = `📝 *Todo:* ${todoDetails.task.charAt(0).toUpperCase() + todoDetails.task.slice(1)}`;
      if (todoDetails.deadline) {
        const deadline = formatDate(todoDetails.deadline);
        todoText += `\n⏰ *Due:* ${deadline}`;
      }
      if (todoDetails.assignee) {
        todoText += `\n👤 *Assignee:* ${todoDetails.assignee}`;
      }

      try {
        const result = await client.chat.postMessage({
          channel: process.env.SLACKDO_CHANNEL_ID,
          text: todoDetails.task, // Adding fallback text for notifications
          blocks: [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": todoText
              }
            },
            {
              "type": "context",
              "elements": [
                {
                  "type": "mrkdwn",
                  "text": `From: <@${message.user}> in <#${message.channel}>`
                }
              ]
            }
          ]
        });

        // Add reactions for status tracking
        await client.reactions.add({
          channel: result.channel,
          timestamp: result.ts,
          name: 'white_check_mark'
        });
        
        await client.reactions.add({
          channel: result.channel,
          timestamp: result.ts,
          name: 'x'
        });

        // Add to recent todos
        recentTodos.add(todoDetails.task.toLowerCase());
        
        setTimeout(() => {
          recentTodos.delete(todoDetails.task.toLowerCase());
        }, 24 * 60 * 60 * 1000);
        
      } catch (listError) {
        process.stdout.write(`❌ Error creating list item: ${listError}\n`);
      }
    }
  } catch (error) {
    process.stdout.write(`❌ Error: ${error}\n`);
  }
});

(async () => {
  try {
    await app.start();
    process.stdout.write('⚡️ Slack bot is running!\n');
  } catch (error) {
    process.stdout.write(`❌ Error starting bot: ${error.message}\n`);
  }
})();