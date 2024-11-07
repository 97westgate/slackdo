require('dotenv').config();
const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

app.message(async ({ message }) => {
  if (message.channel === 'D07UTMDGGAY') {
    console.log('new message!');
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Slack bot is running and monitoring specific DM!');
})();