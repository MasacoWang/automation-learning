# 📋 Interview Feedback Daily — Project Status

**Last updated:** 2026-05-06  
**Repo:** https://github.com/MasacoWang/automation-learning  
**Path:** `projects/interview-feedback-daily/`

---

## 🎯 Goal

Automated daily summary of interview feedback results per requisition from TA Hub (CareerHub).  
Shows: 👍 Hire | 👎 No Hire | ⏳ Pending — grouped by Phone Screen vs Interview.

---

## ✅ What's Done

| Item | Status |
|------|--------|
| Chrome/Edge Extension structure | ✅ Done |
| Extension loads in Edge | ✅ Working |
| Feedback tab extraction (when on candidate page) | ✅ Working |
| Homepage detection (req list) | ✅ Working |
| Icons (16/48/128 PNG) | ✅ Done |
| Power Automate setup guide | ✅ Written |
| Silent fetch-based scanning (background.js) | ⚠️ Limited — SPA doesn't render via fetch |

---

## 🔨 What's In Progress / Next

### Power Automate Flow (DECIDED — next step)
- Reads "provided feedback" notification emails automatically
- Sends Teams + Email digest at 9 AM and 3 PM
- **Guide:** `POWER_AUTOMATE_SETUP.md` — follow step by step
- **Excel tracking:** Need to create Excel on OneDrive, then add "Add row to Excel" step in flow

### Excel Tracker (DECIDED)
- Columns: Date | Req ID | Position | Candidate | Interviewer | Type | Decision | Notes
- File: `Interview_Feedback_Tracker.xlsx` (upload to OneDrive for Power Automate)
- Power Automate adds a row each time new feedback arrives

### Extension Enhancement (PARKED)
- Clickable req cards on homepage → navigate to feedback (popup.js updated, content.js handler NOT added)
- The extension still works for manual extraction when you're ON the feedback tab

---

## 🏗️ Architecture

```
Option A: Power Automate (AUTOMATED — no clicks)
  Email notifications → Parse → Write to Excel → Send Teams/Email digest

Option B: Edge Extension (MANUAL — click "Extract")
  Open TA Hub → Navigate to candidate → Feedback tab → Click extension → See results
```

---

## 📁 Key Files

```
projects/interview-feedback-daily/
├── extension/
│   ├── manifest.json        # Manifest V3, version 1.1.0
│   ├── content.js           # Extraction logic (text-based parser)
│   ├── popup.html/js/css    # Extension UI
│   ├── background.js        # Silent scanning (fetch-based)
│   └── icons/               # 16/48/128 PNG
├── POWER_AUTOMATE_SETUP.md  # Step-by-step Power Automate guide
├── Interview_Feedback_Tracker.xlsx  # (to be created — upload to OneDrive)
├── README.md                # Project overview
└── STATUS.md                # ← THIS FILE
```

---

## 🔑 Technical Notes

- **TA Hub URL:** https://careerhub.microsoft.com
- **It's a React SPA** — pages don't render with simple fetch(), need real browser rendering
- **Feedback text pattern:**
  ```
  [Interviewer Name]
  [JOB TITLE IN ALL CAPS]
  Interview feedback
  [Form Type: "Interview Feedback Template" | "Person Screen"]
  Submitted | Pending
  [Date]
  [Feedback text...]
  ```
- **Decision keywords:** "Strong Hire", "suggest hire" = 👍 | "No Hire", "not recommend" = 👎
- **Extension installed at:** `C:\Users\claricewang\automation-learning\projects\interview-feedback-daily\extension`
- **Extension ID:** fgcbfajkkpofagjjnihlkccfpamannoh

---

## 💡 To Continue on Another Laptop

1. Clone: `git clone https://github.com/MasacoWang/automation-learning`
2. Open Copilot CLI and say: "Continue working on interview-feedback-daily project, see STATUS.md"
3. Main task: Set up the Power Automate flow (follow `POWER_AUTOMATE_SETUP.md`)
4. Then: Create Excel on OneDrive and add the "Add row to Excel" step

---

## 🤔 Open Questions

- What's the exact sender address of feedback notification emails? (msrecruit? careerhub? Microsoft Careers?)
- Do you want the Excel on personal OneDrive or SharePoint?
- Want the extension to auto-export to Excel too, or just Power Automate?
