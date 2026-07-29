#!/usr/bin/env node
// Design: Terminal / CLI aesthetic
import { readFile, writeFile } from "node:fs/promises";

const stats = JSON.parse(await readFile("data/stats.json", "utf8"));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const W = 900;
const H = 460;

const langs = stats.languages.slice(0, 5).map((l) => l.name).join(" · ");
const location = stats.profile.location || "";
const company = (stats.profile.company || "").replace("@", "").trim();
const bioLine = `Senior Engineer, Kubernetes @ ${company || "Atlassian"}`;

const weeks = stats.contributions.calendar.slice(-32).map((w) =>
  w.contributionDays.reduce((s, d) => s + d.contributionCount, 0)
);
const maxWeek = Math.max(1, ...weeks);
const barW = 8;
const barGap = 4;
const barsX = W - 60 - weeks.length * (barW + barGap);
const barsBaseY = 400;
const barsMaxH = 46;

const bars = weeks
  .map((v, i) => {
    const h = Math.max(2, Math.round((v / maxWeek) * barsMaxH));
    const x = barsX + i * (barW + barGap);
    const y = barsBaseY - h;
    const delay = (i * 0.02).toFixed(2);
    return `<rect x="${x}" y="${barsBaseY}" width="${barW}" height="0" rx="2" fill="url(#barGrad)">
      <animate attributeName="height" from="0" to="${h}" begin="${delay}s" dur="0.5s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1"/>
      <animate attributeName="y" from="${barsBaseY}" to="${y}" begin="${delay}s" dur="0.5s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1"/>
    </rect>`;
  })
  .join("\n");

function textWidthApprox(s) {
  return s.length * 8.75;
}

const lines = [
  { t: "cmd", text: `awprice@github ~ % whoami` },
  { t: "out", text: `${stats.profile.name}` },
  { t: "cmd", text: `awprice@github ~ % cat about.txt` },
  { t: "out", text: `${bioLine}` },
  { t: "out", text: `📍 ${location}   🧰 ${langs}` },
  { t: "cmd", text: `awprice@github ~ % gh-stats --user awprice` },
  {
    t: "out",
    text: `★ ${stats.stars} stars    👥 ${stats.profile.followers} followers    📦 ${stats.profile.publicRepos} repos`,
  },
  {
    t: "out",
    text: `📈 ${stats.contributions.totalLastYear} contributions this year    🔥 streak ${stats.contributions.currentStreak}d (best ${stats.contributions.longestStreak}d)`,
  },
  { t: "cmd", text: `awprice@github ~ % _`, cursor: true },
];

let ty = 96;
const lineGap = 30;
const lineEls = lines
  .map((l, i) => {
    const delay = (0.4 + i * 0.55).toFixed(2);
    const color = l.t === "cmd" ? "#7ee787" : "#c9d1d9";
    const y = ty;
    ty += lineGap;
    const cursorEl = l.cursor
      ? `<rect x="${20 + textWidthApprox(l.text)}" y="${y - 14}" width="9" height="18" fill="#7ee787">
          <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.4;0.4;0.9;1" dur="1s" begin="${(Number(delay) + 0.3).toFixed(2)}s" repeatCount="indefinite"/>
        </rect>`
      : "";
    return `<g opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.25s" fill="freeze"/>
      <text x="20" y="${y}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="15" fill="${color}" xml:space="preserve">${esc(l.text)}</text>
      ${cursorEl}
    </g>`;
  })
  .join("\n");

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#161b22"/>
    <stop offset="1" stop-color="#0d1117"/>
  </linearGradient>
  <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#238636"/>
    <stop offset="1" stop-color="#7ee787"/>
  </linearGradient>
  <clipPath id="clip"><rect x="0" y="0" width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#clip)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="none" stroke="#30363d" stroke-width="1"/>
  <rect x="0" y="0" width="${W}" height="40" fill="#161b22"/>
  <line x1="0" y1="40" x2="${W}" y2="40" stroke="#30363d" stroke-width="1"/>
  <circle cx="24" cy="20" r="6" fill="#ff5f56"/>
  <circle cx="46" cy="20" r="6" fill="#ffbd2e"/>
  <circle cx="68" cy="20" r="6" fill="#27c93f"/>
  <text x="${W / 2}" y="25" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="13" fill="#8b949e">awprice@github — zsh — 100×32</text>

  ${lineEls}

  <text x="20" y="${H - 66}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" fill="#484f58">contributions / week (last 32 weeks)</text>
  ${bars}
  <line x1="20" y1="${barsBaseY}" x2="${W - 20}" y2="${barsBaseY}" stroke="#21262d" stroke-width="1"/>

  <text x="20" y="${H - 16}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10" fill="#30363d">auto-updated · last sync ${stats.generatedAt.slice(0, 10)}</text>
</g>
</svg>`;

await writeFile("profile.svg", svg);
console.log("wrote profile.svg");
