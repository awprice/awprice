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
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const ICON_COLOR = "#6e7681";
const CHAR_W = 8.75;

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

// Small single-color line icons, standing in for emoji so nothing in the
// banner competes in color with the terminal palette.
const iconDefs = `
  <symbol id="i-pin" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="6" fill="none" stroke="${ICON_COLOR}" stroke-width="1.4"/>
    <circle cx="7" cy="7" r="2.2" fill="${ICON_COLOR}"/>
  </symbol>
  <symbol id="i-code" viewBox="0 0 14 14">
    <path d="M5.2 2.5L1 7l4.2 4.5 1.1-1-3.2-3.5 3.2-3.5z" fill="${ICON_COLOR}"/>
    <path d="M8.8 2.5L13 7l-4.2 4.5-1.1-1 3.2-3.5-3.2-3.5z" fill="${ICON_COLOR}"/>
  </symbol>
  <symbol id="i-box" viewBox="0 0 14 14">
    <path d="M7 0.5l6.06 3.5v7L7 13.5l-6.06-3.5v-7L7 0.5z" fill="${ICON_COLOR}"/>
  </symbol>
  <symbol id="i-people" viewBox="0 0 14 14">
    <circle cx="5.2" cy="5" r="3" fill="${ICON_COLOR}"/>
    <circle cx="9.6" cy="6.2" r="2.4" fill="${ICON_COLOR}" opacity="0.7"/>
  </symbol>
  <symbol id="i-trend" viewBox="0 0 14 14">
    <rect x="0.5" y="8" width="2.6" height="5.5" fill="${ICON_COLOR}"/>
    <rect x="5.2" y="4.5" width="2.6" height="9" fill="${ICON_COLOR}"/>
    <rect x="9.9" y="0.5" width="2.6" height="13" fill="${ICON_COLOR}"/>
  </symbol>
  <symbol id="i-bolt" viewBox="0 0 14 14">
    <path d="M7.5 0L2 8h3.3L4.3 14 11 5.8H7.6L7.5 0z" fill="${ICON_COLOR}"/>
  </symbol>
`;

function renderLine(y, parts, color) {
  let cx = 20;
  let out = "";
  for (const p of parts) {
    if (p.icon) {
      out += `<use href="#${p.icon}" xlink:href="#${p.icon}" x="${cx}" y="${y - 11}" width="14" height="14"/>`;
      cx += 17;
    } else {
      out += `<text x="${cx}" y="${y}" font-family="${FONT}" font-size="15" fill="${color}" xml:space="preserve">${esc(p.text)}</text>`;
      cx += p.text.length * CHAR_W;
    }
  }
  return { markup: out, endX: cx };
}

const lines = [
  { t: "cmd", parts: [{ text: `awprice@github ~ % whoami` }] },
  { t: "out", parts: [{ text: stats.profile.name }] },
  { t: "cmd", parts: [{ text: `awprice@github ~ % cat about.txt` }] },
  { t: "out", parts: [{ text: bioLine }] },
  {
    t: "out",
    parts: [{ icon: "i-pin" }, { text: ` ${location}   ` }, { icon: "i-code" }, { text: ` ${langs}` }],
  },
  { t: "cmd", parts: [{ text: `awprice@github ~ % gh-stats --user awprice` }] },
  {
    t: "out",
    parts: [
      { text: `★ ${stats.stars} stars    ` },
      { icon: "i-people" },
      { text: ` ${stats.profile.followers} followers    ` },
      { icon: "i-box" },
      { text: ` ${stats.profile.publicRepos} repos` },
    ],
  },
  {
    t: "out",
    parts: [
      { icon: "i-trend" },
      { text: ` ${stats.contributions.totalLastYear} contributions this year    ` },
      { icon: "i-bolt" },
      { text: ` streak ${stats.contributions.currentStreak}d (best ${stats.contributions.longestStreak}d)` },
    ],
  },
  { t: "cmd", parts: [{ text: `awprice@github ~ % _` }], cursor: true },
];

let ty = 96;
const lineGap = 30;
const lineEls = lines
  .map((l, i) => {
    const delay = (0.4 + i * 0.55).toFixed(2);
    const color = l.t === "cmd" ? "#58a6ff" : "#c9d1d9";
    const y = ty;
    ty += lineGap;
    const { markup, endX } = renderLine(y, l.parts, color);
    const cursorEl = l.cursor
      ? `<rect x="${endX}" y="${y - 14}" width="9" height="18" fill="#58a6ff">
          <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.4;0.4;0.9;1" dur="1s" begin="${(Number(delay) + 0.3).toFixed(2)}s" repeatCount="indefinite"/>
        </rect>`
      : "";
    return `<g opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.25s" fill="freeze"/>
      ${markup}
      ${cursorEl}
    </g>`;
  })
  .join("\n");

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#161b22"/>
    <stop offset="1" stop-color="#0d1117"/>
  </linearGradient>
  <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#1f6feb"/>
    <stop offset="1" stop-color="#58a6ff"/>
  </linearGradient>
  <clipPath id="clip"><rect x="0" y="0" width="${W}" height="${H}" rx="14"/></clipPath>
  ${iconDefs}
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
