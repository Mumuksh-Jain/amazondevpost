# RelayCase — GitHub & Devpost Release Guide

**Target Deadline:** October 24, 2026 at 00:30 IST (October 23, 2026, 12:00 PM PDT)

This guide provides the exact commands and steps to publish the repository to GitHub, upload the continuous English video to YouTube/Vimeo, and complete the official Devpost entry.

---

## Step 1: Create and Push to Public GitHub Repository

The local Git repository is already initialized and cleanly committed on branch `main` with all passing tests, zero secrets, zero `.sqlite` files, and zero `.env` files.

1. Go to **https://github.com/new**
2. Repository name: `relaycase` (or `relaycase-alexa-plus`)
3. Set Visibility: **Public**
4. Do **not** initialize with README, .gitignore, or license (they are already present locally).
5. Click **Create repository**.
6. In your terminal inside `d:\hackathons\amazon devpost\RELAYCASE_PASS16_SUBMISSION_KIT\relaycase\`, run:

```bash
git remote add origin https://github.com/Mumuksh-Jain/amazondevpost.git
git branch -M main
git push -u origin main
```

---

## Step 2: Upload Video to YouTube or Vimeo

The verified, continuous English-narrated demonstration video is ready:
- **File location:** `relaycase\RelayCase_Continuous_English_Demo.mp4` (and `..\demo\RelayCase_Continuous_English_Demo.mp4`)
- **Duration:** **170.80 seconds (2m 50s)** — strictly under the 3-minute hackathon limit.
- **Audio:** Clear English spoken narration across all 14 steps.
- **Resolution:** 1600x900 HD progressive H.264.

### YouTube Upload Steps:
1. Go to **https://studio.youtube.com** -> **Create** -> **Upload videos**.
2. Select `RelayCase_Continuous_English_Demo.mp4`.
3. Title: `RelayCase — Bounded Household Responsibility Assistant (Amazon Alexa+ Challenge Demo)`
4. Description:
   ```
   RelayCase is an accountable household responsibility handoff assistant built for the Amazon App Dev Challenge 2026.
   It implements a simulated Alexa+ web experience backed by real Node.js/SQLite state and Model Context Protocol (MCP) tool execution over Streamable HTTP.
   
   GitHub: https://github.com/<YOUR_GITHUB_USERNAME>/relaycase
   Duration: 2m 50s (Under 3 minutes)
   ```
5. Visibility: **Public** (or **Unlisted** if permitted, but Public is safest for judges).
6. Copy the video link (e.g., `https://youtu.be/...`).

---

## Step 3: Complete Devpost Submission

1. Go to the official contest page: **https://amazonappdev2026.devpost.com/**
2. Click **Enter Submission** (or **Edit Submission**).
3. Fill in the submission fields using the text from [`DEVPOST_SUBMISSION.md`](./DEVPOST_SUBMISSION.md):
   - **Project Name:** `RelayCase — Bounded Household Responsibility Assistant`
   - **Tagline:** `An accountable household handoff assistant enforcing human consent, immutable preview hashes, and strict boundaries between claims and physical proof.`
   - **Video URL:** Paste the YouTube/Vimeo link from Step 2.
   - **GitHub Repository URL:** Paste the GitHub URL from Step 1.
   - **Story & Description:** Copy-paste the sections from `DEVPOST_SUBMISSION.md` (Inspiration, What It Does, How We Built It, Challenges, Product Feedback & Real SDK Friction, What We Learned, What's Next).
   - **Built With:** `Node.js`, `SQLite`, `JavaScript`, `HTML5`, `CSS3`, `Model Context Protocol (MCP)`, `Chrome DevTools Protocol`, `FFmpeg`
4. Confirm preview and click **Submit**.
5. Save the confirmation receipt / page URL. Ensure this is completed before **October 24, 2026, 00:30 IST**!
