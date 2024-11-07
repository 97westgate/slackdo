require('dotenv').config();
const { App } = require('@slack/bolt');
const OpenAI = require('openai');
const stringSimilarity = require('string-similarity');

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4-0613", // gpt-4o when time to impress folx
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

    const response = completion.choices[0].message.content.trim().toLowerCase();
    
    if (response.includes('yes')) {
      process.stdout.write('🎯 Todo item detected!\n');
      
      // Check for duplicates
      if (isSimilarToExisting(message.text)) {
        process.stdout.write('⚠️ Duplicate todo detected, skipping...\n');
        return;
      }
      
      try {
        // Send message to Slackdo
        const result = await client.chat.postMessage({
          channel: process.env.SLACKDO_CHANNEL_ID,
          text: message.text
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
        recentTodos.add(message.text.toLowerCase());
        
        // Optional: Clear old todos after some time
        setTimeout(() => {
          recentTodos.delete(message.text.toLowerCase());
        }, 24 * 60 * 60 * 1000); // Clear after 24 hours
        
      } catch (listError) {
        process.stdout.write(`❌ Error creating list item: ${listError}\n`);
      }
    }
  } catch (error) {
    process.stdout.write(`❌ Error checking todo: ${error}\n`);
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