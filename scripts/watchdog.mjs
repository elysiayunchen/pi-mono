#!/usr/bin/env node
/**
 * Elynyx Gateway Watchdog — standalone process (NOT a gateway child).
 *
 * Probes the gateway health endpoint every 30 s.  After 3 consecutive
 * failures it restarts the gateway via systemctl and sends a Telegram
 * alert using its own Bot API token (zero dependency on gateway code paths).
 *
 * Usage:
 *   ELYNYX_WATCHDOG_TG_TOKEN=<bot-token> ELYNYX_WATCHDOG_TG_CHAT=<chat-id> \\
 *     node scripts/watchdog.mjs [--port 18789] [--interval 30] [--max-fails 3]
 */

import http from "node:http";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Configuration (env vars or argv)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : fallback;
}

const GW_PORT = Number(getArg("port", process.env.ELYNYX_WATCHDOG_PORT ?? "18789"));
const CHECK_INTERVAL_S = Number(getArg("interval", process.env.ELYNYX_WATCHDOG_INTERVAL ?? "30"));
const MAX_FAILS = Number(getArg("max-fails", process.env.ELYNYX_WATCHDOG_MAX_FAILS ?? "3"));
const TG_TOKEN = process.env.ELYNYX_WATCHDOG_TG_TOKEN ?? "";
const TG_CHAT = process.env.ELYNYX_WATCHDOG_TG_CHAT ?? "";
const GW_SERVICE = process.env.ELYNYX_WATCHDOG_SERVICE ?? "elynx-gateway";
// "1" → gateway runs as a systemd *user* unit (systemctl --user).
const SYSTEMCTL_USER = (process.env.ELYNYX_WATCHDOG_SYSTEMCTL_USER ?? "") === "1";
// Outbound HTTPS proxy for Telegram (Node's global fetch ignores HTTP_PROXY env).
const TG_PROXY = process.env.ELYNYX_WATCHDOG_PROXY ?? "";
const RESTART_COOLDOWN_MS = Number(
  process.env.ELYNYX_WATCHDOG_RESTART_COOLDOWN ?? String(5 * 60 * 1000),
);
const MAX_RESTART_FAILS = Number(process.env.ELYNYX_WATCHDOG_MAX_RESTART_FAILS ?? "3");
// Deploy pause marker — deploy.sh touches this while it restarts the gateway,
// so a deploy window never triggers a false watchdog restart + alarm.
// A stale marker (crashed deploy) is ignored after PAUSE_MAX_AGE_MS.
const PAUSE_FILE =
  process.env.ELYNYX_WATCHDOG_PAUSE_FILE ??
  `${process.env.HOME ?? "/home/elysia"}/.elysiaclaw/watchdog-pause`;
const PAUSE_MAX_AGE_MS = Number(
  process.env.ELYNYX_WATCHDOG_PAUSE_MAX_AGE ?? String(15 * 60 * 1000),
);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let consecutiveFails = 0;
let lastRestartTime = 0;
let lastAlertKey = "";
let consecutiveRestartFails = 0;
let autoRestartDisabled = false;
const HEALTH_URL = `http://127.0.0.1:${GW_PORT}/health`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString();
  process.stdout.write(`[watchdog ${ts}] ${msg}\n`);
}

function probeHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(res.statusCode >= 200 && res.statusCode < 400));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function restartGateway() {
  const now = Date.now();
  if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
    log(`restart skipped — within cooldown (last: ${new Date(lastRestartTime).toISOString()})`);
    return false;
  }
  lastRestartTime = now;
  log(`restarting ${GW_SERVICE}...`);
  try {
    const args = SYSTEMCTL_USER
      ? ["--user", "restart", GW_SERVICE]
      : ["restart", GW_SERVICE];
    execFileSync("systemctl", args, { timeout: 30_000 });
    log(`restart command issued`);
    return true;
  } catch (err) {
    log(`restart failed: ${err.message}`);
    return false;
  }
}

async function sendTelegramAlert(text, kind = "gw-down") {
  if (!TG_TOKEN || !TG_CHAT) {
    log("TG alert skipped — missing ELYNYX_WATCHDOG_TG_TOKEN or ELYNYX_WATCHDOG_TG_CHAT");
    return;
  }
  // Flap suppression key includes the alert kind — otherwise a recovery or
  // restart-storm alert landing in the same minute as the down alert is eaten.
  const alertKey = `${kind}:${Math.floor(Date.now() / 60000)}`;
  if (alertKey === lastAlertKey) {
    log("TG alert skipped — same alert window (flap suppression)");
    return;
  }
  lastAlertKey = alertKey;
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: TG_CHAT,
    text,
    disable_notification: false,
  });
  try {
    if (TG_PROXY) {
      // Node's global fetch does not honor HTTP_PROXY env vars; route via curl.
      execFileSync(
        "curl",
        ["-sS", "--fail", "--max-time", "10", "--proxy", TG_PROXY,
         "-H", "Content-Type: application/json", "-d", body, url],
        { timeout: 15_000, stdio: ["ignore", "ignore", "pipe"] },
      );
      log(`TG alert sent (via proxy): ${text}`);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      log(`TG alert failed: HTTP ${resp.status}`);
    } else {
      log(`TG alert sent: ${text}`);
    }
  } catch (err) {
    log(`TG alert error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function isDeployPaused() {
  try {
    const st = fs.statSync(PAUSE_FILE);
    return Date.now() - st.mtimeMs <= PAUSE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

async function check() {
  if (isDeployPaused()) {
    if (consecutiveFails > 0) consecutiveFails = 0;
    log("deploy pause marker present — skipping probe cycle");
    return;
  }
  const alive = await probeHealth();
  if (alive) {
    consecutiveFails = 0;
    consecutiveRestartFails = 0;
    if (autoRestartDisabled) {
      autoRestartDisabled = false;
      log("gateway healthy again — auto-restart re-enabled");
      await sendTelegramAlert("网关已恢复健康，自动重启功能重新启用。", "gw-reenabled");
    }
    return;
  }
  consecutiveFails += 1;
  log(`health probe failed (${consecutiveFails}/${MAX_FAILS})`);

  if (consecutiveFails < MAX_FAILS) return;

  if (autoRestartDisabled) {
    log("auto-restart disabled (restart storm) — waiting for manual intervention");
    return;
  }

  const alertMsg = `网关挂了 (${consecutiveFails}次连续失败)，尝试自动重启 ${GW_SERVICE}...`;
  log(alertMsg);
  await sendTelegramAlert(alertMsg);

  const restarted = await restartGateway();
  if (restarted) {
    consecutiveFails = 0;
    // Wait a bit for the service to come up, then check again.
    await new Promise((r) => setTimeout(r, 10_000));
    const recovered = await probeHealth();
    if (recovered) {
      log("gateway recovered after restart");
      consecutiveRestartFails = 0;
      await sendTelegramAlert("网关已自动恢复。", "gw-recovered");
      return;
    }
    log("gateway still unreachable after restart — will retry next cycle");
  }
  // Restart command failed, or it succeeded but the gateway never came back.
  consecutiveRestartFails += 1;
  if (consecutiveRestartFails >= MAX_RESTART_FAILS) {
    autoRestartDisabled = true;
    const storm = `连续 ${consecutiveRestartFails} 次重启无效，已停止自动重启 ${GW_SERVICE}，需人工介入。`;
    log(storm);
    await sendTelegramAlert(`🚨 ${storm}`, "gw-storm");
  }
}

async function main() {
  log(`starting — port=${GW_PORT} interval=${CHECK_INTERVAL_S}s max_fails=${MAX_FAILS}`);
  if (!TG_TOKEN) {
    log("WARNING: ELYNYX_WATCHDOG_TG_TOKEN not set — Telegram alerts disabled");
  }
  // Run checks on a fixed interval.
  setInterval(check, CHECK_INTERVAL_S * 1000);
  // Run the first check immediately.
  check();
}

main();
