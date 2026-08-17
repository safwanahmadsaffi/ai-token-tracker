# AI Usage and Quota Tracker (Skysize Odoo + Chrome Extension)

This project provides a comprehensive solution for tracking and limiting AI token usage across multiple providers (ChatGPT, Claude, DeepSeek, Gemini) for teams.

## Architecture

1.  **Odoo Module (`ai_usage_quota_tracker`)**: The backend system running on **Skysize**. It manages usage logs, quota configurations, and sends alerts when users exceed 80% of their daily limit.
2.  **Chrome Extension (`chrome_extension`)**: The client-side tool that monitors token usage in real-time on chat platforms and pushes the data to the Odoo instance via a JSON-RPC API.

## Odoo Instance (Skysize)
- **URL**: [https://ai-token-tracker.skysize.io](https://ai-token-tracker.skysize.io)
- **Features**: 
    - Daily Quotas (Admin Configurable)
    - 80% Usage Alerts (Odoo Activities)
    - Midnight Auto-Reset/Cleanup
    - Usage Analytics (Pivot & Graph Views)

## Chrome Extension
- **Features**:
    - Real-time token counting for ChatGPT (BPE) and others (Heuristic).
    - Automatic sync to Odoo backend.
    - Floating toolbar for document exports (PDF, Word, etc.).

## Setup Instructions

### 1. Deploy Odoo Module
- The `ai_usage_quota_tracker` folder is automatically detected by Skysize.
- In Odoo, go to **Apps > Update Apps List** and install **AI Usage and Quota Tracker**.

### 2. Install Chrome Extension
- Navigate to `chrome_extension` folder.
- Run `npm install && npm run build`.
- Load the `dist/` folder in `chrome://extensions` (Developer Mode).

---
*Developed by Safwan Ahmad Saffi*

