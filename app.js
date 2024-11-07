require('dotenv').config();
const { App } = require('@slack/bolt');
const OpenAI = require('openai');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Your Slack user ID - add this to your .env file
const YOUR_USER_ID = process.env.SLACK_USER_ID;

app.message(async ({ message, client }) => {
  process.stdout.write(`Analyzing message: ${message.text}\n`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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
      
      // Send DM to you
      await client.chat.postMessage({
        channel: YOUR_USER_ID, // This will create a DM
        text: `New Todo detected!\n>${message.text}\nFrom: <@${message.user}> in <#${message.channel}>`,
        unfurl_links: false
      });
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