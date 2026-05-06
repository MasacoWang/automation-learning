# 🧩 Interview Feedback Daily — Chrome Extension

## Install (2 minutes)

1. Open Chrome → type `chrome://extensions` → press Enter
2. Toggle **"Developer mode"** ON (top-right)
3. Click **"Load unpacked"** (top-left)
4. Select this folder: `projects/interview-feedback-daily/extension/`
5. Done! You'll see the 📋 icon in your toolbar

## How to Use

1. Open [TA Hub](https://careerhub.microsoft.com) → any requisition → **Feedback tab**
2. Click the 📋 extension icon in your toolbar
3. Click **"🔄 Extract from Page"**
4. See the summary → click:
   - **📋 Copy** — copies formatted summary to clipboard
   - **📧 Email** — opens Outlook with pre-filled summary
   - **💬 Teams** — sends to Teams channel via webhook

## What It Extracts

| Data | Source |
|------|--------|
| Requisition title + ID | Page header |
| Candidate names | Feedback tab / pipeline view |
| Interviewer names | Each feedback row |
| Decision (👍 Hire / 👎 No Hire) | Green/red thumb icons |
| Form type (Interview / Phone Screen / Quick Notes) | Feedback form label |
| Status (Submitted / Pending) | Status indicator |
| Date | Submission date |

## Optional: Teams Webhook Setup

To use the **"💬 Teams"** button:

1. In Teams, go to your channel → **⋯** → **Connectors** → **Incoming Webhook**
2. Name it "Interview Feedback" → Create
3. Copy the webhook URL
4. In the extension popup → **⚙️ Settings** → paste the URL → Save

## Security

- ✅ Only READS the page — never modifies TA Hub
- ✅ No data sent anywhere unless you click Share
- ✅ Runs 100% locally in your browser
- ✅ Open source — you can read all the code
