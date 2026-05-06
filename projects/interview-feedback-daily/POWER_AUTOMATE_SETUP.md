# 📋 Interview Feedback Daily Notification — Power Automate Setup

## What This Does

You'll receive an **automatic daily digest at 9 AM and 3 PM** via **Teams + Email** summarizing all new interview feedback — without ever opening TA Hub.

---

## ⚡ Step-by-Step Setup (15 minutes)

### Step 1: Go to Power Automate

1. Open https://make.powerautomate.com
2. Sign in with your Microsoft work account

---

### Step 2: Create Flow — "Interview Feedback Daily Digest"

1. Click **"+ Create"** → **"Scheduled cloud flow"**
2. Name it: `Interview Feedback Daily Digest`
3. Set schedule:
   - Start: **Today**
   - Repeat every: **1 day**
   - At these hours: **9** and **15** (for 9 AM and 3 PM)
   - On these days: **Mon, Tue, Wed, Thu, Fri**
4. Click **Create**

---

### Step 3: Add Action — Search Emails from TA Hub

The notification emails look like:
> **From:** Microsoft Careers  
> **Subject:** "Microsoft Careers provided feedback for [Candidate Name]"  
> **Body:** Position ID, candidate info (location, experience, skills), link to view feedback

1. Click **"+ New step"**
2. Search for: **"Office 365 Outlook"**
3. Select: **"Search emails (V3)"**
4. Configure:
   - **Folder**: Inbox (or specific folder if you have rules)
   - **Search query**: 
     ```
     from:Microsoft Careers AND subject:"provided feedback"
     ```
   - **Top**: 50
   - **Filter query** (last 8 hours for twice-daily runs):
     ```
     receivedDateTime ge @{addHours(utcNow(), -8)}
     ```

---

### Step 4: Add Action — Parse and Collect Results

1. Click **"+ New step"** → **"Initialize variable"**
   - Name: `FeedbackSummary`
   - Type: **String**
   - Value: (leave empty)

2. Click **"+ New step"** → **"Apply to each"**
   - Select: `value` (from the email search results)
   - Inside the loop, add **"Append to string variable"**:
     - Name: `FeedbackSummary`
     - Value:
       ```
       📩 @{items('Apply_to_each')?['subject']}
       📅 Received: @{formatDateTime(items('Apply_to_each')?['receivedDateTime'], 'MMM dd, hh:mm tt')}
       🆔 @{first(split(last(split(items('Apply_to_each')?['bodyPreview'], 'Position ID (if applicable): ')), char(10)))}
       ━━━━━━━━━━━━━━━━━━━━━━━━
       
       ```
   
   > This extracts: candidate name (from subject), timestamp, and Position ID from the email body.

---

### Step 5: Add Condition — Only Send If There's New Feedback

1. Click **"+ New step"** → **"Condition"**
   - Variable `FeedbackSummary` **is not equal to** (empty string)
   - If **Yes** → continue to Step 6
   - If **No** → do nothing (ends the flow)

---

### Step 6: Send to Teams

1. Inside the **"If yes"** branch, click **"Add an action"**
2. Search: **"Microsoft Teams"**
3. Select: **"Post message in a chat or channel"**
4. Configure:
   - **Post as**: Flow bot
   - **Post in**: Chat with Flow bot (sends to YOU personally)
   - **Message**:
     ```
     📋 Interview Feedback Daily Summary
     📅 @{formatDateTime(utcNow(), 'dddd, MMM dd yyyy')} — @{if(equals(formatDateTime(utcNow(), 'HH'), '09'), '9 AM', '3 PM')} Update
     
     @{variables('FeedbackSummary')}
     
     🔗 Open TA Hub: https://careerhub.microsoft.com
     ```

---

### Step 7: Send Email Digest

1. Click **"Add an action"** (still inside "If yes")
2. Search: **"Office 365 Outlook"**
3. Select: **"Send an email (V2)"**
4. Configure:
   - **To**: your email
   - **Subject**: `📋 Interview Feedback Update — @{formatDateTime(utcNow(), 'MMM dd')} @{if(equals(formatDateTime(utcNow(), 'HH'), '09'), '9 AM', '3 PM')}`
   - **Body**:
     ```html
     <h2>📋 Interview Feedback Daily Summary</h2>
     <p><strong>📅 @{formatDateTime(utcNow(), 'dddd, MMM dd yyyy')}</strong></p>
     <hr>
     <pre>@{variables('FeedbackSummary')}</pre>
     <hr>
     <p>🔗 <a href="https://careerhub.microsoft.com">Open TA Hub</a></p>
     ```

---

### Step 8: Save and Test

1. Click **"Save"** (top right)
2. Click **"Test"** → **"Manually"** → **"Run flow"**
3. Check your Teams chat and email — you should receive a test message!

---

## 🎨 Flow Diagram

```
┌──────────────────────────────────────────────────┐
│  ⏰ Recurrence (9 AM + 3 PM, Mon-Fri)           │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  📧 Search Outlook for TA Hub feedback emails    │
│     from:careerhub subject:feedback (last 24h)   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  🔄 Loop through emails → build summary text     │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  ❓ Any new feedback?                            │
│     YES → send Teams + Email                     │
│     NO  → skip (no notification)                 │
└──────────────────────┬───────────────────────────┘
                       ▼
┌─────────────────────────┐ ┌──────────────────────┐
│  💬 Teams notification  │ │  📧 Email digest     │
└─────────────────────────┘ └──────────────────────┘
```

---

## 📝 Tips

- **If you don't get emails from TA Hub**: Ask your admin to enable notifications, or check if they go to a subfolder/Focused inbox
- **Want to include more detail**: Add an HTML table action to parse candidate names from email bodies
- **Want it for your team**: Share the flow or create a Team channel version
- **Adjust timing**: Edit the recurrence trigger to change schedule

---

## 🔒 Security & Compliance

- ✅ Power Automate is Microsoft-native (no third-party)
- ✅ Runs under YOUR account permissions only
- ✅ No data leaves Microsoft 365
- ✅ No API keys or webhooks to manage
- ✅ Org-approved tool — no IT approval needed
