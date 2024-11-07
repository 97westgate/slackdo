# Slackdo Bot

A simple Slack bot that monitors messages and detects todo items using OpenAI's GPT-3.5.

## Prerequisites

- Node.js installed on your machine
- A Slack workspace where you can add apps
- OpenAI API key
- Slack bot token, signing secret, and app token

## Installation

1. Clone this repository:
   - `git clone [your-repo-url]`
   - `cd slackdo-bot`

2. Install dependencies:
   - `npm install @slack/bolt openai dotenv string-similarity`

3. Create a `.env` file in the root directory with the following structure:

   ```
   # Slack Credentials
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   SLACK_APP_TOKEN=xapp-your-app-token-here
   SLACKDO_CHANNEL_ID=D07V4EMTCTG-your-slackdo-dm-channel-id

   # OpenAI Credentials
   OPENAI_API_KEY=your-openai-api-key-here
   ```

### Where to find these credentials:

#### Slack Credentials (at api.slack.com):
- `SLACK_BOT_TOKEN`: Found under "OAuth & Permissions" → "Bot User OAuth Token"
- `SLACK_SIGNING_SECRET`: Found under "Basic Information" → "App Credentials" → "Signing Secret"
- `SLACK_APP_TOKEN`: Found under "Basic Information" → "App-Level Tokens" (Create one with `connections:write` scope)

#### OpenAI Credentials:
- `OPENAI_API_KEY`: Found in your OpenAI account dashboard under "API Keys"

## Required Slack Bot Permissions

In your Slack App settings (api.slack.com), add these Bot Token Scopes:
- `channels:history`
- `channels:read`
- `chat:write`
- `im:history`
- `im:read`
- `reactions:write` (for adding status reactions)

## Running the Bot

Start the bot with:
- `node app.js`

You should see: "⚡️ Slack bot is running!"

## Usage

1. Invite the bot to channels you want it to monitor:
   - Type `/invite @YourBotName` in the channel

2. The bot will analyze messages using GPT-3.5 to detect todo items and tasks
3. When a todo item is detected:
   - It checks for similar existing todos to prevent duplicates
   - Sends the todo to Slackdo bot
   - Adds ✅ and ❌ reactions for status tracking
4. Duplicate todos are automatically cleared after 24 hours

## Troubleshooting

- Make sure all environment variables are set correctly in `.env`
- Verify the bot is "Active" (green dot) in Slack
- Check that the bot has been invited to channels you want it to monitor
- Ensure your OpenAI API key has sufficient credits

## Limitations

This bot can only monitor messages within a single Slack workspace. It cannot:
- Monitor messages across multiple workspaces
- Access messages in other workspaces, even if you're a member
- Be used with Slack Connect channels between workspaces

This is a Slack platform limitation for security reasons. Enterprise Grid customers may have different capabilities.

