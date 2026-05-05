# 📘 VS Code & Automation Guidebook for Recruiters

> A beginner-friendly guide to using VS Code and building automation tools — no tech degree needed.

---

## 📑 Table of Contents

1. [What is VS Code?](#1-what-is-vs-code)
2. [Setting Up VS Code](#2-setting-up-vs-code)
3. [Understanding the Interface](#3-understanding-the-interface)
4. [Essential Extensions](#4-essential-extensions)
5. [Terminal Basics](#5-terminal-basics)
6. [Your First Automation Script](#6-your-first-automation-script)
7. [Automation Ideas for Recruiters](#7-automation-ideas-for-recruiters)
8. [Working with GitHub Copilot](#8-working-with-github-copilot)
9. [Common Workflows](#9-common-workflows)
10. [Troubleshooting](#10-troubleshooting)
11. [Learning Roadmap](#11-learning-roadmap)

---

## 1. What is VS Code?

**VS Code** (Visual Studio Code) is a free text editor made by Microsoft. Think of it as a super-powered Notepad that helps you write code.

### Why VS Code for automation?
- ✅ Free and lightweight
- ✅ Built-in terminal (command line inside the editor)
- ✅ Extensions add superpowers (like GitHub Copilot)
- ✅ Works with every programming language
- ✅ Huge community = easy to Google problems

### VS Code vs. other tools

| Tool | Best For |
|------|----------|
| VS Code | Writing code, building tools |
| Excel/Sheets | Data manipulation, simple formulas |
| Power Automate | No-code workflows (email triggers, etc.) |
| Python scripts | Repetitive tasks, data processing |

**You already use VS Code!** You built your prompt website using it. This guide will help you understand it deeper.

---

## 2. Setting Up VS Code

### You already have it installed ✅

If you ever need to reinstall:
1. Go to https://code.visualstudio.com
2. Download for Windows
3. Install (keep all default options checked)

### First-time settings to change

Open Settings: `Ctrl + ,` (comma)

| Setting | What to change | Why |
|---------|---------------|-----|
| Font Size | 14-16 | Easier to read |
| Auto Save | `afterDelay` | Never lose work |
| Word Wrap | `on` | See full lines without scrolling |
| Theme | Pick one you like | Comfort matters |

---

## 3. Understanding the Interface

```
┌─────────────────────────────────────────────────────┐
│  Menu Bar (File, Edit, View...)                      │
├────────┬────────────────────────────────────────────┤
│        │                                            │
│ Side   │         Editor Area                        │
│ Bar    │    (where you write code)                  │
│        │                                            │
│ 📁     │                                            │
│ 🔍     ├────────────────────────────────────────────┤
│ 🔀     │                                            │
│ 🐛     │         Terminal                           │
│ 🧩     │    (command line)                          │
│        │                                            │
└────────┴────────────────────────────────────────────┘
```

### Key areas:

| Area | What it does | Shortcut |
|------|-------------|----------|
| Explorer (📁) | Browse your files | `Ctrl + Shift + E` |
| Search (🔍) | Find text across all files | `Ctrl + Shift + F` |
| Source Control (🔀) | Git (save versions) | `Ctrl + Shift + G` |
| Extensions (🧩) | Install add-ons | `Ctrl + Shift + X` |
| Terminal | Run commands | `` Ctrl + ` `` |

### Most used shortcuts

| Action | Shortcut | Use case |
|--------|----------|----------|
| Open file | `Ctrl + P` | Quick jump to any file |
| Command palette | `Ctrl + Shift + P` | Do anything by name |
| Save | `Ctrl + S` | Save current file |
| Undo | `Ctrl + Z` | Undo last change |
| Find in file | `Ctrl + F` | Search current file |
| Find in all files | `Ctrl + Shift + F` | Search entire project |
| Toggle terminal | `` Ctrl + ` `` | Show/hide command line |
| Split editor | `Ctrl + \` | View 2 files side by side |

---

## 4. Essential Extensions

Open Extensions: `Ctrl + Shift + X`, then search and click "Install"

### Must-have for beginners

| Extension | What it does |
|-----------|-------------|
| **GitHub Copilot** | AI writes code for you (you already have this!) |
| **Prettier** | Auto-formats your code to look clean |
| **Auto Rename Tag** | Rename HTML tags automatically |
| **Error Lens** | Shows errors right on the line (not hidden) |
| **Path Intellisense** | Auto-completes file paths |

### Nice to have

| Extension | What it does |
|-----------|-------------|
| **Thunder Client** | Test APIs without leaving VS Code |
| **GitLens** | See who changed what and when |
| **Live Server** | Preview HTML files in browser instantly |
| **Code Spell Checker** | Catches typos in your code |

---

## 5. Terminal Basics

The terminal is the command line inside VS Code. Open it with `` Ctrl + ` ``

### Commands you'll use daily

```powershell
# Navigate folders
cd folder-name          # Go into a folder
cd ..                   # Go back one level
ls                      # List files in current folder

# Git (version control)
git status              # See what changed
git add .               # Stage all changes
git commit -m "message" # Save a snapshot
git push                # Upload to GitHub

# Node.js (for web projects)
npm install             # Install dependencies
npm run dev             # Start local server
npm run build           # Build for production

# Python (for automation scripts)
python script.py        # Run a Python script
pip install package     # Install a Python package
```

### Tips
- Press `↑` arrow to repeat last command
- Press `Tab` to auto-complete file/folder names
- Type `cls` to clear the screen
- If something is stuck, press `Ctrl + C` to stop it

---

## 6. Your First Automation Script

Let's build something useful: a script that generates personalized outreach emails from a CSV file.

### Step 1: Install Python

1. Go to https://www.python.org/downloads/
2. Download latest version
3. **Important:** Check ✅ "Add Python to PATH" during install
4. Verify: Open terminal in VS Code, type `python --version`

### Step 2: Create your first script

Create a file called `email-generator.py`:

```python
# My first automation script!
# This reads candidate names and generates personalized emails

candidates = [
    {"name": "Sarah", "role": "Software Engineer", "company": "Google"},
    {"name": "James", "role": "Product Manager", "company": "Meta"},
]

template = """
Hi {name},

I came across your profile and was impressed by your experience as a {role} at {company}.

We have an exciting opportunity that aligns with your background. Would you be open to a brief chat this week?

Best regards,
Clarice
"""

for candidate in candidates:
    email = template.format(**candidate)
    print(f"--- Email for {candidate['name']} ---")
    print(email)
```

### Step 3: Run it

In the terminal:
```
python email-generator.py
```

🎉 You just automated email generation!

### Step 4: Level up — Read from a CSV file

```python
import csv

# Read candidates from a CSV file
with open('candidates.csv', 'r') as file:
    reader = csv.DictReader(file)
    for row in reader:
        email = template.format(
            name=row['Name'],
            role=row['Role'],
            company=row['Company']
        )
        print(email)
```

Create `candidates.csv`:
```
Name,Role,Company
Sarah,Software Engineer,Google
James,Product Manager,Meta
Lisa,Data Scientist,Amazon
```

---

## 7. Automation Ideas for Recruiters

### 🟢 Beginner (start here)

| Idea | What it does | Language |
|------|-------------|----------|
| Email generator | Personalize outreach from a list | Python |
| Interview scheduler | Generate calendar invite text | Python |
| JD formatter | Clean up job descriptions | Python |
| LinkedIn message variants | Create A/B test versions | Python |

### 🟡 Intermediate

| Idea | What it does | Language |
|------|-------------|----------|
| Resume keyword scanner | Check if CV matches JD | Python |
| Pipeline tracker | Track candidates in a web app | JavaScript |
| Auto-reply sorter | Categorize email responses | Python |
| Salary data scraper | Collect market rate data | Python |

### 🔴 Advanced

| Idea | What it does | Language |
|------|-------------|----------|
| ATS integration | Auto-push candidates to system | Python + API |
| Interview feedback tool | Collect & summarize feedback | Next.js |
| Sourcing assistant | AI-powered candidate matching | Python + AI |

---

## 8. Working with GitHub Copilot

You already have Copilot — here's how to use it effectively:

### In VS Code (code suggestions)
1. Start typing a comment describing what you want:
   ```python
   # Read a CSV file and count how many candidates are from each company
   ```
2. Copilot suggests the code — press `Tab` to accept
3. If the suggestion isn't right, press `Alt + ]` to see alternatives

### In the terminal (Copilot CLI)
You're already doing this! The chat you're in right now is Copilot CLI.

### Tips for better Copilot results
- Write clear comments before the code you need
- Give examples of input/output in comments
- Break complex tasks into small steps
- If Copilot suggests wrong code, add more context in comments

### Example workflow
```python
# Task: Read candidates.csv, filter only those with 5+ years experience,
# and generate a personalized email for each one

# Step 1: Read the CSV
# (Copilot will write this for you)

# Step 2: Filter candidates with 5+ years
# (Copilot will write this for you)

# Step 3: Generate email using template
# (Copilot will write this for you)
```

---

## 9. Common Workflows

### Workflow 1: Starting a new project

```powershell
# 1. Create a folder
mkdir my-new-project
cd my-new-project

# 2. Initialize git
git init

# 3. Open in VS Code
code .

# 4. Create your first file
# (Use the Explorer panel or Ctrl+N)
```

### Workflow 2: Making changes to your website

```powershell
# 1. Open your project
cd C:\Users\claricewang\PromptsWebsite
code .

# 2. Start the dev server (see changes live)
npm run dev

# 3. Edit files, see changes in browser at localhost:3000

# 4. When happy, save and push
git add .
git commit -m "describe what you changed"
git push
```

### Workflow 3: Building a Python automation

```powershell
# 1. Create project folder
mkdir recruiter-tools
cd recruiter-tools

# 2. Create a virtual environment (keeps packages isolated)
python -m venv venv
.\venv\Scripts\activate

# 3. Install packages you need
pip install pandas openpyxl  # for Excel files
pip install requests         # for APIs

# 4. Create your script
# (write .py files in VS Code)

# 5. Run it
python your-script.py
```

---

## 10. Troubleshooting

### "Command not found"
- **Cause:** The program isn't installed or not in PATH
- **Fix:** Reinstall and check "Add to PATH" option

### "Module not found" (Python)
- **Cause:** Package not installed
- **Fix:** `pip install package-name`

### "Port already in use"
- **Cause:** Another server is running
- **Fix:** Close other terminal tabs or use a different port

### Git says "nothing to commit"
- **Cause:** No changes since last commit
- **Fix:** Make sure you saved your files (`Ctrl + S`)

### VS Code feels slow
- **Fix:** Disable extensions you're not using
- **Fix:** Close unused tabs (`Ctrl + W`)

### "Permission denied"
- **Fix:** Run terminal as Administrator (right-click VS Code → Run as Admin)

### Need help?
1. Copy the error message
2. Ask Copilot CLI (this chat!) — paste the error and explain what you were trying to do
3. Google the error message (StackOverflow usually has answers)

---

## 11. Learning Roadmap

### Month 1: Foundation
- [ ] Get comfortable with VS Code interface
- [ ] Learn terminal basics (cd, ls, git commands)
- [ ] Write your first Python script
- [ ] Practice: Build the email generator from Section 6

### Month 2: Python for Automation
- [ ] Learn to read/write CSV and Excel files
- [ ] Learn basic string manipulation
- [ ] Learn if/else logic and loops
- [ ] Practice: Build a resume keyword scanner

### Month 3: Web & APIs
- [ ] Understand how APIs work (GET, POST)
- [ ] Use the `requests` library in Python
- [ ] Connect to a simple API
- [ ] Practice: Pull data from a job board API

### Month 4: Build Real Tools
- [ ] Combine skills into a useful tool
- [ ] Deploy it (web app or desktop script)
- [ ] Share with team members
- [ ] Practice: Build a pipeline dashboard

### Ongoing
- [ ] Use Copilot to learn faster (ask it to explain code)
- [ ] Join r/learnpython on Reddit
- [ ] Watch YouTube: "Python for Beginners" by Mosh
- [ ] Build one small thing every week

---

## 🎯 Remember

1. **You don't need to memorize** — use Copilot and Google
2. **Start small** — one script that saves 10 minutes is a win
3. **Break problems down** — every big tool is just small steps combined
4. **Errors are normal** — even senior engineers Google errors daily
5. **You already proved you can do this** — you built an entire website!

---

## 📚 Free Resources

| Resource | Link | Best for |
|----------|------|----------|
| Python Basics | https://www.learnpython.org | Interactive lessons |
| freeCodeCamp | https://www.freecodecamp.org | Full courses (free) |
| Automate the Boring Stuff | https://automatetheboringstuff.com | Python automation (free book) |
| VS Code Docs | https://code.visualstudio.com/docs | Official guide |
| GitHub Skills | https://skills.github.com | Git & GitHub basics |

---

*Created: May 2026 | Author: Clarice Wang*
*Built with the help of GitHub Copilot CLI*
