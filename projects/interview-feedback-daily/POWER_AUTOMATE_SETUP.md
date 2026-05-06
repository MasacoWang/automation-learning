# ⚡ Power Automate — Interview Feedback Daily Digest

## What You'll Get

Every day at **9 AM** and **3 PM**, you receive a **Teams message + Email** like this:

```
📋 Interview Feedback Update — May 6, 2026 (9 AM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📩 3 new feedback received since last check:

👤 Ruo-Chun Tzeng → Senior Applied Scientist (200034822)
   📅 Apr 13, 2026

👤 Mason Hsu → Sr. Power Hardware Engineer (200032105)
   📅 Apr 14, 2026

👤 Patt Chang → Sr. Power Hardware Engineer (200032105)
   📅 Apr 15, 2026

🔗 View in TA Hub: https://careerhub.microsoft.com
```

**Zero effort.** You just receive it.

---

## Setup (10 minutes)

### Step 1: Open Power Automate

Go to: **https://make.powerautomate.com**

Sign in with your work account.

---

### Step 2: Create the Flow

1. Click **+ Create** (left sidebar)
2. Click **Scheduled cloud flow**
3. Fill in:
   - **Flow name:** `Interview Feedback Daily Digest`
   - **Starting:** Today
   - **Repeat every:** `1 Day`
4. Click **Create**

---

### Step 3: Edit the Recurrence Trigger

After creating, click on the **Recurrence** trigger box to expand it:

- **Interval:** 1
- **Frequency:** Day
- **Time zone:** (UTC+08:00) Taipei
- **At these hours:** `9,15` ← this means 9 AM and 3 PM
- **On these days:** Monday, Tuesday, Wednesday, Thursday, Friday

---

### Step 4: Add "Search Emails"

1. Click **+ New step**
2. Search for: `Office 365 Outlook`
3. Select: **Search emails (V3)**
4. Fill in:
   - **Search query:**
     ```
     from:msrecruit subject:"provided feedback"
     ```
   - **Folder:** Inbox
   - **Top:** 50
   - Click **Show advanced options**
   - **Filter Query:**
     ```
     receivedDateTime ge @{addHours(utcNow(), -8)}
     ```

> This finds all "provided feedback" emails from the last 8 hours (since your last check).

---

### Step 5: Initialize Summary Variable

1. Click **+ New step**
2. Search: `Variable`
3. Select: **Initialize variable**
4. Fill in:
   - **Name:** `FeedbackSummary`
   - **Type:** String
   - **Value:** (leave empty)

---

### Step 6: Initialize Counter

1. Click **+ New step**
2. Search: `Variable`
3. Select: **Initialize variable**
4. Fill in:
   - **Name:** `FeedbackCount`
   - **Type:** Integer
   - **Value:** `0`

---

### Step 7: Loop Through Emails

1. Click **+ New step**
2. Search: `Control`
3. Select: **Apply to each**
4. In "Select an output from previous steps": choose `value` (from the Search emails step)

**Inside the loop, add 2 actions:**

#### Action A: Increment counter

1. Click **Add an action** (inside the loop)
2. Search: `Variable`
3. Select: **Increment variable**
4. **Name:** `FeedbackCount`
5. **Value:** `1`

#### Action B: Append to summary

1. Click **Add an action** (inside the loop)
2. Search: `Variable`
3. Select: **Append to string variable**
4. **Name:** `FeedbackSummary`
5. **Value:** (paste this exactly)

```
📩 @{items('Apply_to_each')?['subject']}
📅 @{formatDateTime(items('Apply_to_each')?['receivedDateTime'], 'MMM dd, yyyy hh:mm tt')}
━━━━━━━━━━━━━━━━━━━━
```

---

### Step 8: Add Condition (Only Send If New Feedback Exists)

1. Click **+ New step** (OUTSIDE the loop — after "Apply to each" ends)
2. Search: `Control`
3. Select: **Condition**
4. Set:
   - **Value:** `@{variables('FeedbackCount')}`
   - **is greater than**
   - **Value:** `0`

---

### Step 9: If Yes — Send Teams Message

Inside the **If yes** branch:

1. Click **Add an action**
2. Search: `Microsoft Teams`
3. Select: **Post message in a chat or channel**
4. Fill in:
   - **Post as:** Flow bot
   - **Post in:** Chat with Flow bot
   - **Message:**

```
📋 Interview Feedback Update — @{formatDateTime(utcNow(), 'MMM dd, yyyy')} @{if(equals(formatDateTime(utcNow(), 'HH'), '09'), '9 AM', '3 PM')}

@{variables('FeedbackCount')} new feedback received:

@{variables('FeedbackSummary')}

🔗 View in TA Hub: https://careerhub.microsoft.com
```

---

### Step 10: If Yes — Send Email

Still inside **If yes** branch:

1. Click **Add an action**
2. Search: `Office 365 Outlook`
3. Select: **Send an email (V2)**
4. Fill in:
   - **To:** `your-email@microsoft.com` ← replace with your email
   - **Subject:**
     ```
     📋 Interview Feedback — @{formatDateTime(utcNow(), 'MMM dd')} @{if(equals(formatDateTime(utcNow(), 'HH'), '09'), '9 AM', '3 PM')} (@{variables('FeedbackCount')} new)
     ```
   - **Body:**
     ```
     📋 Interview Feedback Daily Update
     📅 @{formatDateTime(utcNow(), 'dddd, MMM dd yyyy')}

     @{variables('FeedbackCount')} new feedback received since last check:

     @{variables('FeedbackSummary')}

     🔗 Open TA Hub: https://careerhub.microsoft.com
     ```

---

### Step 11: Save and Test

1. Click **Save** (top right)
2. Click **Test** → **Manually** → **Run flow**
3. Check your Teams (Flow bot chat) and email!

---

## ✅ You're Done!

From now on, every weekday at 9 AM and 3 PM, you'll automatically get a Teams message and email with all new interview feedback notifications — grouped by candidate and requisition.

**No TA Hub login needed. No clicking. Just receive your update.**

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No emails found | Check the `from:` address — it might be `msrecruit@microsoft.com` or `careerhub@microsoft.com`. Test the search in Outlook first. |
| Flow never triggers | Make sure the schedule is set to your timezone (UTC+08:00 Taipei) |
| Empty summary | The filter query time window might need adjusting — try `addHours(utcNow(), -12)` for a wider window |
| Want to include req ID | The email subject already contains it: "provided feedback for [Name]" + Position ID is in the body |

---

## Want More Detail?

The basic flow gives you a notification list. To parse the **actual hire/no-hire decision** from the email body, you'd need to add a "Parse HTML" step. Let me know if you want that added later.
