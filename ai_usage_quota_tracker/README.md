# AI Usage and Quota Tracker (Odoo Module for Skysize)

This module is designed to track and limit AI token usage across multiple providers (ChatGPT, Claude, DeepSeek, Gemini).

## Features
- **Usage Tracking**: Records every token consumption event.
- **Quota Management**: Set daily limits per user or globally.
- **80% Alert**: Automatically creates an Odoo activity when a user reaches 80% of their daily quota.
- **Daily Reset**: A scheduled action runs every midnight to clean up or reset tracking.
- **External API**: Provides a JSON-RPC endpoint for Chrome Extensions to log usage data.

## Deployment on Skysize
1. Add the `ai_usage_quota_tracker` folder to your Odoo GitHub repository.
2. Skysize will automatically detect the new module.
3. Go to **Apps** in Odoo, click **Update Apps List**, and install **AI Usage and Quota Tracker**.

## API Endpoint for Chrome Extension
The module exposes the following endpoint to receive data from your extension:
- **URL**: `YOUR_ODOO_URL/ai_tracker/log_usage`
- **Method**: `POST` (JSON-RPC)
- **Payload**:
  ```json
  {
    "params": {
      "provider": "chatgpt",
      "model": "gpt-4o",
      "tokens": 150
    }
  }
  ```

## Integration with your provided files
You can modify your `src/background/serviceWorker.js` in the Chrome extension to send a `fetch` request to this Odoo endpoint whenever a token count event is triggered.
