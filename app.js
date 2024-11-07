require('dotenv').config();
const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Debug: Log when the bot starts up
process.stdout.write('Starting bot...\n');

// Add error handling
app.error(async (error) => {
  process.stdout.write(`⚠️ Error: ${error.message}\n`);
});

// Listen to all messages
app.message(async ({ message, say }) => {
  process.stdout.write(`Received message in channel: ${message.channel}\n`);
  process.stdout.write(`Message content: ${message.text}\n`);
  process.stdout.write(`Full message details: ${JSON.stringify(message, null, 2)}\n`);
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