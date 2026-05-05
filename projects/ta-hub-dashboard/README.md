# 📊 TA Hub Dashboard — Chrome Extension

A Chrome extension that adds a floating dashboard to TA Hub (CareerHub) showing feedback status, candidate pipeline, and recommended next actions.

## What it does

When you're on TA Hub, a floating panel appears on the right showing:
- **Pipeline counts** — how many candidates in each stage
- **Feedback status** — which interviewers submitted, which are pending
- **Action needed** — candidates waiting for your decision
- **Recommendation** — dispose or continue based on feedback completion

## How to install (5 minutes)

### Step 1: Download the extension
The extension files are in this folder (`projects/ta-hub-dashboard/`).

### Step 2: Open Chrome Extensions page
1. Open Chrome
2. Type `chrome://extensions` in the address bar
3. Press Enter

### Step 3: Enable Developer Mode
- In the top-right corner, toggle **"Developer mode"** ON

### Step 4: Load the extension
1. Click **"Load unpacked"** (top-left button)
2. Navigate to this folder: `projects/ta-hub-dashboard/`
3. Select the folder and click "Select Folder"

### Step 5: Use it!
1. Go to [TA Hub](https://careerhub.microsoft.com)
2. Open any requisition
3. The dashboard will appear on the right side of the page
4. Click the **−** button to minimize, click again to expand
5. Click **🔄 Refresh** to update data

## How it works (for learning)

```
You open TA Hub page
        ↓
Chrome extension activates (content.js)
        ↓
Script reads the page HTML (not an API — just reads what you see)
        ↓
Extracts: candidate names, stages, feedback status
        ↓
Creates a floating dashboard panel
        ↓
Shows summary + recommendations
```

### Key concepts used:
- **Chrome Extension** — a mini-app that runs inside your browser
- **Content Script** — JavaScript that runs on specific websites
- **DOM Reading** — reading information from the webpage's HTML structure
- **CSS Injection** — adding custom styles to make the dashboard look good

## ⚠️ Important Notes

1. **This reads, it doesn't write.** The extension only LOOKS at data on the page. It never clicks buttons, changes data, or interacts with TA Hub.

2. **Data stays local.** Nothing is sent to any server. All processing happens in your browser.

3. **May need adjustments.** Since I can't access TA Hub directly, the CSS selectors might need tweaking. If the dashboard shows "0" for everything, we need to update the selectors to match the actual page structure.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard doesn't appear | Refresh the page, wait 2 seconds |
| Shows all zeros | The page structure may have changed — tell me and I'll update the selectors |
| Dashboard in wrong position | Drag the header to reposition |
| Want to disable it | Go to chrome://extensions → toggle off |

## Future improvements
- [ ] Export data to CSV
- [ ] Daily digest summary
- [ ] Alert when feedback is pending > 3 days
- [ ] Compare across multiple reqs
