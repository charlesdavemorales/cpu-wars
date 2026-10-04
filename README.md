# CPU WARS V4 — 10-Mission Multiplayer Replay Edition

A group educational CPU power-consumption simulation based on the user's four-page `CPU_Power_Consumption.docx`. Teams of up to three students: one Mission Reader and two CPU Engineers. One person registers individually per device. The simulation and all grading run on the server, not on students' browsers.

## NEW in V4: replay without overwriting results

- Attempt 1 contains the **original 10 manual-aligned missions**, shuffled for each squad.
- After finishing all ten, the finished screen displays **PLAY AGAIN — ATTEMPT 2**. Any team member may click after coordinating with teammates. The button only appears once the current attempt is finished.
- On each following attempt, the server picks **five original questions from missions 1–10** and **five additional questions from a bank of 15 new manual-aligned missions (IDs 11–25)**. It shuffles all ten. Mission order and scenarios differ per attempt and squad.
- Original missions rotate in complementary sets of five across two consecutive replays. All fifteen extra missions are offered over a three-replay rotation before reshuffling, reducing immediate repetition.
- The new run gets a **fresh elapsed timer, zero heat, no crashes, new mission scores**, and automatically proceeds through its own ten missions. It is an entirely new game attempt, unlike **Repair & Retry** after an in-game CPU crash (which stays in the same attempt, preserves the timer, sets heat to 25 and charges a 420-second penalty).
- The previous result becomes an **immutable historical leaderboard entry**. The first attempt appears as `Squad 01-1`, the next as `Squad 01-2`, then `Squad 01-3`, etc. **Every attempt is a separate ranking entry.** A squad can therefore occupy multiple leaderboard positions. The host's CSV has separate per-student records for each run, with its time, heat, life, crashes, score and the ten mission titles/results. Previous member rosters are snapshotted, so late students do not retrospectively appear on attempts before they joined.
- Results last while the current server state is available. **Render Free storage is ephemeral:** regularly export the CSV and private JSON recovery backup, especially before redeploying or resetting the room. An uploaded/deleted repository or redeployment is NOT permanent result storage.

## Update your existing GitHub → Render deployment

1. **Before deploying, use the old game's Download Grades CSV and Save Recovery Backup.** V3/V3.1 private JSON backup is not accepted by V4 because saved mission orders and run histories have changed. V3 scores are available only in the V3 CSV; they are not automatically merged into V4's in-game leaderboard.
2. Download and unzip the V4 project. Open the enclosed `cpu-wars` folder. Upload all of its **contents** to the **root** of the new/existing GitHub `cpu-wars` repository (not the ZIP and not an extra nested `cpu-wars` directory). In particular check `public/model.js` and the new `runs.js` both exist: `server.js` requires them. Remove obsolete files from older editions.
3. Commit to `main`; go to your existing Render Web Service, check **Settings → Build → Source** is connected to your recreated repo, then select **Manual Deploy → Deploy latest commit** if auto-deploy has not begun.
4. Leave **Root Directory blank** when `package.json` is at repository root. Use Build Command `npm install` and Start Command `npm start`, with `NODE_ENV=production` and your private `HOST_PASSWORD` (at least ten characters) in Render Environment Variables.
5. Once Render shows `Live`, refresh the site using Ctrl+Shift+R. Use `/?host=1` for host. **Start a fresh V4 room.** Students access the ordinary HTTPS link and register individually. Render might need time to wake if the Free instance was idle.

## Local testing on Windows

Install Node.js 20+ and run from inside the folder containing `package.json`:

```powershell
npm install
npm test
$env:HOST_PASSWORD="PUT-A-PRIVATE-PASSWORD-HERE"
$env:NODE_ENV="production"
npm start
```

Open `http://localhost:3000/?host=1` for teacher; `http://localhost:3000/` for student. Do not put your private host password in GitHub files.

## How students play

1. Teacher creates a room. Students join individually and are automatically assigned to incomplete three-member teams. They can choose an incomplete existing squad. Late entry is still available, including when a team is playing a new attempt.
2. Mission Reader receives the scenario and target (numeric or functional) and explains it to two CPU Engineers. Engineers manipulate live CPU controls. If alone, a reader can also operate controls until another student joins. Each person can see the current team roster.
3. Engineers experiment for free with the telemetry. Pressing **TEST THIS CPU BUILD** actually submits it. A perfect solution (20/20) cools CPU heat by 6; an imperfect passing solution earns fewer points and raises heat; an unsuccessful build adds 24 heat. At heat 100 the CPU crashes. **Repair & Retry** resumes the CURRENT mission after resetting heat to 25 but retains its running timer and increases crash count.
4. A completed mission unlocks a short manual-based explanation, then automatically progresses after eight seconds. The host does not manually click Next.
5. Upon completing stage ten, the server freezes that attempt's time, CPU health, breakdown and members. Its historical result immediately appears on the leaderboard. Students may stop, or press **PLAY AGAIN** to launch an independent run with a new ten-mission selection.

## Ranking and grading

A completed attempt ranks ahead of unfinished attempts. Among finished attempts:

```
adjusted_seconds = actual_elapsed_seconds + 5 × ending_heat + 420 × crashes_in_that_attempt
CPU_life = 100 − ending_heat
```

**Lower adjusted time wins.** Mission points (maximum 200 before ten-point crash deductions) are also saved but do not determine the main rank. For fairness when grading teams with multiple runs, decide ahead of time whether to use first attempt, best completed attempt, or all separate entries. The online leaderboard intentionally preserves all of them as requested. The CSV includes each attempt suffix and student roster as it existed on that run.

## New mission bank and accuracy

See `MANUAL_MISSION_MAP.md` for all 25 mission titles and links to the manual sections. Existing first-attempt questions remain the original V3.1 ten, while later attempts use 5 originals plus 5 extras. Game watt/temperature/work-unit targets are illustrative. The 15-minute agricultural monitoring interval is from the manual; awake-second choices are game values.

## Copy/screenshot deterrents

Private mission text remains restricted from selection/copy, is watermarked with reader/team/run and hidden during normal printing; it blurs when the browser tab is unfocused. Distinct missions and run orders make copying between teams less useful. **A browser cannot reliably prevent OS screenshots, external camera photos or determined copying**. Apply class participation rules as well.

## Project files

```
cpu-wars/
  public/index.html
  public/style.css
  public/app.js
  public/model.js
  server.js
  challenges.js
  mission-order.js
  progression.js
  rankings.js
  runs.js            # NEW — immutable run history and fresh replay
  teams.js
  test/model.test.js
  package.json
  render.yaml
  README.md
  MANUAL_MISSION_MAP.md
```

Run `npm test` before deployment. The app stores state in `.game-state.json` by default for local recovery; Render Free's filesystem is not durable. Keep backup JSON private: it contains student names/IDs and reconnection tokens. V4 backups can be restored using the V4 host dashboard.
