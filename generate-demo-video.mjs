// Automated Continuous English Demo Video Generator for RelayCase
// Produces a continuous, English-narrated 1600x900 MP4 demo video strictly under 3 minutes
// using authentic Windows Chrome screenshots, PowerShell TTS narration, and FFmpeg.
import {spawn, execSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG_BIN = 'C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';
const FFPROBE_BIN = 'C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffprobe.exe';
const WORK_DIR = join(process.cwd(), 'demo_build');
if (existsSync(WORK_DIR)) rmSync(WORK_DIR, {recursive: true, force: true});
mkdirSync(WORK_DIR, {recursive: true});

const SCENES = [
  {
    id: '01',
    shot: 'screenshots_e2e/01_login_page.png',
    badge: '01 · ARCHITECTURE & SCOPE',
    title: 'RelayCase: Bounded Household Responsibility Assistant',
    subtitle: 'Simulated Alexa+ web experience · Built for Amazon App Dev Challenge 2026',
    narration: 'Welcome to RelayCase, a bounded household responsibility handoff assistant created for the Amazon Alexa Plus hackathon. RelayCase provides an accountability layer for AI-mediated household task delegation, ensuring AI assistants cannot unilaterally commit humans to real-world tasks or falsely verify physical completion.'
  },
  {
    id: '02',
    shot: 'screenshots_e2e/02_priya_dashboard.png',
    badge: '02 · DEMO IDENTITY AUTHENTICATION',
    title: 'Authenticated Requester Environment',
    subtitle: 'Identity: Priya · Private state, isolated household credentials',
    narration: 'We sign in as Priya using demo credentials. RelayCase maintains private, isolated states across household members, backed by a local SQLite database with transactional integrity.'
  },
  {
    id: '03',
    shot: 'screenshots_e2e/03_assistant_who_can_help.png',
    badge: '03 · MCP TOOL DISCOVERY',
    title: 'Simulated Assistant Invokes Real Local MCP Tool',
    subtitle: 'Tool: list_eligible_members · Streamable HTTP Model Context Protocol',
    narration: 'In the assistant panel, Priya asks who can help. Rather than using an unverified model hallucination, the simulated assistant communicates via standard Model Context Protocol over HTTP, discovering eligible household members: Sam and Alex.'
  },
  {
    id: '04',
    shot: 'screenshots_e2e/04_assistant_draft_created.png',
    badge: '04 · PERSISTED DRAFT CREATION',
    title: 'Draft Created via Model Context Protocol',
    subtitle: 'Tool: create_handoff_draft · Persisted in SQLite as DRAFT',
    narration: 'Next, Priya directs the assistant: draft Bring the parcel box indoors to Sam. The assistant executes the create_handoff_draft MCP tool. Crucially, saving a draft is not an invitation. No human has agreed yet.'
  },
  {
    id: '05',
    shot: 'screenshots_e2e/06_preview_awaiting_approval.png',
    badge: '05 · IMMUTABLE PREVIEW HASH',
    title: 'Draft Previewed: Awaiting Requester Approval',
    subtitle: 'State: AWAITING_REQUESTER_APPROVAL · Content digest and version locked',
    narration: 'Priya opens the draft and clicks Preview request. The case enters AWAITING_REQUESTER_APPROVAL with an immutable hash of the title, instructions, and assignee.'
  },
  {
    id: '06',
    shot: 'screenshots_e2e/07_unapproved_send_blocked.png',
    badge: '06 · SECURITY ENFORCEMENT',
    title: 'Security Gate: Unauthorized Send Blocked',
    subtitle: '403 APPROVAL_REQUIRED · AI models cannot bypass human sign-off',
    narration: 'If an agent or user attempts to send this invitation before human approval, the server firmly blocks it with an APPROVAL_REQUIRED error. AI tools cannot authorize commitments on a human\'s behalf.'
  },
  {
    id: '07',
    shot: 'screenshots_e2e/08_approval_confirmed.png',
    badge: '07 · FIRST-PARTY APPROVAL',
    title: 'First-Party Human Approval Recorded',
    subtitle: 'Explicit UI approval · Server-derived humanApprovalReady marker',
    narration: 'Priya explicitly clicks Approve invitation in the first-party interface, recording an unconsumed, time-limited approval. The UI confirms approval while keeping sending as a deliberate separate action.'
  },
  {
    id: '08',
    shot: 'screenshots_e2e/09_invitation_sent.png',
    badge: '08 · INVITATION DISPATCH',
    title: 'Approved Invitation Dispatched to Assignee',
    subtitle: 'State: AWAITING_ASSIGNEE_RESPONSE · Assignee attempt created',
    narration: 'Priya then clicks Send approved invitation. The invitation is dispatched and the case status advances to AWAITING_ASSIGNEE_RESPONSE.'
  },
  {
    id: '09',
    shot: 'screenshots_e2e/11_sam_views_invitation.png',
    badge: '09 · RECIPIENT VISIBILITY',
    title: 'Assignee Session: Sam Views Invitation',
    subtitle: 'Identity: Sam · Independent consent required',
    narration: 'Priya signs out, and Sam signs in with his separate identity credential. Sam opens the case, seeing Priya\'s request. Human consent is strictly required, never inferred.'
  },
  {
    id: '10',
    shot: 'screenshots_e2e/12_sam_accepted.png',
    badge: '10 · HUMAN COMMITMENT',
    title: 'Human Acceptance Recorded',
    subtitle: 'State: ACCEPTED · Explicit commitment from assignee',
    narration: 'Sam clicks Accept responsibility. The case status transitions to ACCEPTED, recording Sam\'s explicit human agreement in the event log.'
  },
  {
    id: '11',
    shot: 'screenshots_e2e/13_sam_claimed_done.png',
    badge: '11 · CLAIM VS PROOF',
    title: 'Completion Claimed (Not Independently Verified)',
    subtitle: 'State: CLAIMED_DONE · Preserving the boundary between claim and proof',
    narration: 'Once the physical task is performed, Sam clicks Report I finished. The status becomes CLAIMED_DONE. RelayCase makes a vital distinction: a human claim is recorded, but software cannot independently verify physical reality.'
  },
  {
    id: '12',
    shot: 'screenshots_e2e/15_closed_acknowledged.png',
    badge: '12 · LOOP CLOSURE',
    title: 'Requester Acknowledges Completion Report',
    subtitle: 'State: CLOSED_ACKNOWLEDGED · Requester closes the loop',
    narration: 'Sam signs out, and Priya signs back in. She reviews Sam\'s report and clicks Acknowledge report, closing the case in the CLOSED_ACKNOWLEDGED state.'
  },
  {
    id: '13',
    shot: 'screenshots_e2e/16_persisted_audit_timeline.png',
    badge: '13 · PERSISTENCE & AUDIT',
    title: 'Persisted SQLite Audit Timeline',
    subtitle: 'Complete ordered history survives process restarts',
    narration: 'Clicking Load history displays the complete, ordered event timeline, persisted in SQLite across server restarts and process closures.'
  },
  {
    id: '14',
    shot: 'screenshots_e2e/17_mobile_responsive_case.png',
    badge: '14 · RELEASE GATES VERIFIED',
    title: 'Responsive Mobile Architecture & Verified MCP SDK',
    subtitle: 'Streamable HTTP transport · 35/35 tests · 19/19 judge checks · 9/9 SDK checks',
    narration: 'RelayCase features a fully responsive mobile layout, passes 35 regression tests, 19 judge rehearsal checks, and 9 official Model Context Protocol TypeScript SDK checks with zero external dependencies in core mode. Thank you for reviewing RelayCase.'
  }
];

console.log(`[VIDEO] Generating voice narration clips for ${SCENES.length} scenes...`);

// 1. Synthesize audio clips using PowerShell TTS
for (const scene of SCENES) {
  const wavPath = join(WORK_DIR, `audio_${scene.id}.wav`);
  const safeText = scene.narration.replace(/["`$]/g, '').replace(/—/g, ', ');
  const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft David Desktop")
$synth.Rate = 1
$synth.SetOutputToWaveFile("${wavPath.replace(/\\/g, '\\\\')}")
$synth.Speak("${safeText}")
$synth.Dispose()
`;
  const psFile = join(WORK_DIR, `tts_${scene.id}.ps1`);
  writeFileSync(psFile, psScript, 'utf8');
  execSync(`powershell -ExecutionPolicy Bypass -File "${psFile}"`);
  
  const durStr = execSync(`"${FFPROBE_BIN}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`).toString().trim();
  scene.duration = parseFloat(durStr);
  scene.audioFile = wavPath;
  console.log(`[VIDEO] Scene ${scene.id}: ${scene.duration.toFixed(2)}s - "${scene.badge}"`);
}

const totalAudioDuration = SCENES.reduce((acc, s) => acc + s.duration, 0);
console.log(`[VIDEO] Total spoken narration duration: ${totalAudioDuration.toFixed(2)} seconds (under 3 minutes target: 180s)`);

// 2. Render each composite frame using Chrome CDP
console.log('[VIDEO] Launching Chrome to render 1600x900 styled composite frames...');
const cdpPort = 9260;
const chromeDataDir = join(tmpdir(), 'relaycase_video_' + Date.now());
mkdirSync(chromeDataDir, {recursive: true});

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${chromeDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  'about:blank'
], {stdio: 'ignore'});

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const {resolve, reject} = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.ws.send(JSON.stringify({id, method, params}));
    });
  }
}

try {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      targets = await res.json();
      if (targets && targets.length) break;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  for (const scene of SCENES) {
    const imgData = readFileSync(scene.shot).toString('base64');
    const isMobile = scene.shot.includes('mobile');
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { width: 1600px; height: 900px; background: #0b0f19; overflow: hidden; display: flex; flex-direction: column; }
.header-bar {
  height: 48px; background: #111827; border-bottom: 1px solid #1f2937;
  display: flex; align-items: center; justify-content: space-between; padding: 0 32px;
}
.brand-box { display: flex; align-items: center; gap: 12px; }
.brand-mark { background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 16px; }
.brand-title { color: white; font-weight: 700; font-size: 16px; letter-spacing: -0.02em; }
.live-badge { background: #064e3b; color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid #059669; }
.banner-disclaimer { color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; }

.viewport-container {
  flex: 1; display: flex; align-items: center; justify-content: center; background: #0f172a; padding: 16px; position: relative;
}
.app-screen {
  max-width: ${isMobile ? '380px' : '1360px'};
  max-height: 700px;
  border-radius: ${isMobile ? '24px' : '12px'};
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  border: 1px solid #334155;
  object-fit: contain;
}

.lower-third {
  height: 125px; background: linear-gradient(180deg, #111827 0%, #030712 100%);
  border-top: 2px solid #2563eb; display: flex; flex-direction: column; justify-content: center;
  padding: 0 40px; position: relative;
}
.badge {
  color: #60a5fa; font-size: 12px; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px;
}
.title {
  color: #f8fafc; font-size: 24px; font-weight: 750; letter-spacing: -0.02em; margin-bottom: 4px;
}
.subtitle {
  color: #94a3b8; font-size: 14.5px; font-weight: 500;
}
.step-pill {
  position: absolute; right: 40px; top: 38px;
  background: #1e293b; color: #cbd5e1; border: 1px solid #475569;
  font-size: 13px; font-weight: 650; padding: 6px 14px; border-radius: 999px;
}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand-box">
      <div class="brand-mark">↗</div>
      <span class="brand-title">RelayCase</span>
      <span class="live-badge">REAL NODE.JS / HTTP MCP BACKEND</span>
    </div>
    <div class="banner-disclaimer">SIMULATED ALEXA+ EXPERIENCE · BOUNDED HOUSEHOLD DELEGATION</div>
  </div>
  <div class="viewport-container">
    <img class="app-screen" src="data:image/png;base64,${imgData}">
  </div>
  <div class="lower-third">
    <div class="badge">${scene.badge}</div>
    <div class="title">${scene.title}</div>
    <div class="subtitle">${scene.subtitle}</div>
    <div class="step-pill">Step ${scene.id} of 14</div>
  </div>
</body>
</html>`;

    const htmlPath = join(WORK_DIR, `frame_${scene.id}.html`);
    writeFileSync(htmlPath, html, 'utf8');
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

    await cdp.send('Page.navigate', {url: fileUrl});
    await new Promise(r => setTimeout(r, 400));
    const res = await cdp.send('Page.captureScreenshot', {format: 'png'});
    const framePng = join(WORK_DIR, `rendered_${scene.id}.png`);
    writeFileSync(framePng, Buffer.from(res.data, 'base64'));
    scene.framePng = framePng;
    console.log(`[VIDEO] Rendered frame ${scene.id}`);
  }

} finally {
  chromeProc.kill('SIGKILL');
  try { rmSync(chromeDataDir, {recursive: true, force: true}); } catch {}
}

// 3. Render video clips with ffmpeg
console.log('[VIDEO] Encoding MP4 video clips with ffmpeg...');
const clips = [];
for (const scene of SCENES) {
  const clipFile = join(WORK_DIR, `clip_${scene.id}.mp4`);
  // Pad with 0.3s silence so speech ends cleanly before transition
  const clipDuration = scene.duration + 0.35;
  const cmd = `"${FFMPEG_BIN}" -v error -y -loop 1 -i "${scene.framePng}" -i "${scene.audioFile}" -t ${clipDuration.toFixed(3)} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${clipFile}"`;
  execSync(cmd);
  clips.push(clipFile);
  console.log(`[VIDEO] Encoded clip ${scene.id} (${clipDuration.toFixed(2)}s)`);
}

// 4. Concatenate all clips
console.log('[VIDEO] Concatenating all clips into final demo video...');
const concatList = join(WORK_DIR, 'concat.txt');
writeFileSync(concatList, clips.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

const finalVideoLocal = join(process.cwd(), 'RelayCase_Continuous_English_Demo.mp4');
const finalVideoKit = join(process.cwd(), '..', 'demo', 'RelayCase_Continuous_English_Demo.mp4');

const concatCmd = `"${FFMPEG_BIN}" -v error -y -f concat -safe 0 -i "${concatList.replace(/\\/g, '/')}" -c copy "${finalVideoLocal}"`;
execSync(concatCmd);

// Also copy to ../demo/ folder
writeFileSync(finalVideoKit, readFileSync(finalVideoLocal));

// 5. Inspect final video metadata
const probeJson = execSync(`"${FFPROBE_BIN}" -v error -show_entries format=duration,size,bit_rate -show_streams -of json "${finalVideoLocal}"`).toString();
const meta = JSON.parse(probeJson);
const finalDuration = parseFloat(meta.format.duration);
const vStream = meta.streams.find(s => s.codec_type === 'video');
const aStream = meta.streams.find(s => s.codec_type === 'audio');

console.log('\n========================================');
console.log('RELAYCASE CONTINUOUS DEMO VIDEO READY');
console.log('========================================');
console.log(`File: ${finalVideoLocal}`);
console.log(`Kit File: ${finalVideoKit}`);
console.log(`Duration: ${finalDuration.toFixed(2)} seconds (Requirement: under 3 minutes = 180s) -> ${finalDuration < 180 ? 'PASS' : 'FAIL'}`);
console.log(`Resolution: ${vStream.width}x${vStream.height} (${vStream.codec_name})`);
console.log(`Audio: ${aStream.codec_name} (${aStream.sample_rate} Hz, ${aStream.channel_layout})`);
console.log(`File Size: ${(parseInt(meta.format.size) / (1024 * 1024)).toFixed(2)} MB`);
console.log('========================================\n');
