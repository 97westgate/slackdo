require('dotenv').config();
const { App } = require('@slack/bolt');
const OpenAI = require('openai');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Initialize OpenAI with the new syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.message(async ({ message }) => {
  process.stdout.write(`Analyzing message: ${message.text}\n`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Is this message a todo item? Message: "${message.text}"`,
      }],
      max_tokens: 60,
    });
    if (completion.choices[0].message.content.toLowerCase().includes('yes')) {
      process.stdout.write('Todo item detected!\n');
    }
  } catch (error) {
    process.stdout.write(`Error checking todo: ${error}\n`);
  }
});

(async () => {
  try {
    const port = 3000;
    await app.start(port);
    process.stdout.write(`⚡️ Slack bot is running on port ${port}!\n`);
  } catch (error) {
    process.stdout.write(`❌ Error starting bot: ${error.message}\n`);
  }
})();