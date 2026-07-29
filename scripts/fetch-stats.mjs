#!/usr/bin/env node
// Fetches GitHub profile + activity stats and writes data/stats.json.
// Requires GH_TOKEN env var (a token with read access to public data).
import { writeFile, mkdir } from "node:fs/promises";

const USERNAME = process.env.GH_USERNAME || "awprice";
const TOKEN = process.env.GH_TOKEN;

if (!TOKEN) {
  console.error("GH_TOKEN env var is required");
  process.exit(1);
}

const restHeaders = {
  Authorization: `bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
};

async function rest(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: restHeaders });
  if (!res.ok) throw new Error(`REST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function fetchProfile() {
  return rest(`/users/${USERNAME}`);
}

async function fetchAllRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const batch = await rest(`/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner`);
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

async function fetchContributions() {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoryContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
          commitContributionsByRepository(maxRepositories: 100) {
            repository {
              nameWithOwner
              isFork
              languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
                edges {
                  size
                  node { name }
                }
              }
            }
            contributions { totalCount }
          }
        }
      }
    }`;
  const data = await graphql(query, { login: USERNAME });
  return data.user.contributionsCollection;
}

function computeStreaks(weeks) {
  const days = weeks.flatMap((w) => w.contributionDays);
  let longest = 0;
  let running = 0;
  for (const d of days) {
    if (d.contributionCount > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].contributionCount > 0) {
      current += 1;
    } else if (current > 0) {
      break;
    }
  }
  return { longest, current };
}

// Build/config file types that Linguist tags as a "language" but that don't
// reflect a language someone would say they "work in".
const NON_LANGUAGES = new Set([
  "Makefile",
  "Dockerfile",
  "Go Template",
  "HCL",
  "Jsonnet",
  "Starlark",
  "Yacc",
  "HTML",
  "CSS",
  "SCSS",
  "Less",
  "YAML",
  "JSON",
  "TOML",
  "INI",
  "XSLT",
  "Smarty",
  "M4",
  "Procfile",
  "Roff",
  "Batchfile",
  "Diff",
  "Text",
  "Markdown",
  "Nginx",
  "Vim Script",
  "EJS",
  "Handlebars",
]);

// Weights languages by recent commit activity (last 12 months) rather than
// static repo counts, so languages you've moved on from don't linger.
function computeRecentLanguages(commitContributionsByRepository) {
  const weighted = {};
  for (const entry of commitContributionsByRepository) {
    const repo = entry.repository;
    if (!repo || repo.isFork) continue;
    const commits = entry.contributions.totalCount;
    const edges = (repo.languages?.edges || []).filter((e) => !NON_LANGUAGES.has(e.node.name));
    const totalBytes = edges.reduce((sum, e) => sum + e.size, 0);
    if (!totalBytes) continue;
    for (const e of edges) {
      const share = e.size / totalBytes;
      weighted[e.node.name] = (weighted[e.node.name] || 0) + commits * share;
    }
  }
  return Object.entries(weighted)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, weight]) => ({ name, weight }));
}

async function main() {
  const [profile, repos, contributions] = await Promise.all([
    fetchProfile(),
    fetchAllRepos(),
    fetchContributions(),
  ]);

  const ownedNonForks = repos.filter((r) => !r.fork);
  const totalStars = ownedNonForks.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const languages = computeRecentLanguages(contributions.commitContributionsByRepository);
  const streaks = computeStreaks(contributions.contributionCalendar.weeks);
  const mostRecent = [...repos]
    .filter((r) => !r.fork)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))[0];

  const stats = {
    generatedAt: new Date().toISOString(),
    profile: {
      login: profile.login,
      name: profile.name,
      bio: profile.bio,
      company: profile.company,
      location: profile.location,
      avatarUrl: profile.avatar_url,
      createdAt: profile.created_at,
      followers: profile.followers,
      following: profile.following,
      publicRepos: profile.public_repos,
    },
    stars: totalStars,
    languages,
    contributions: {
      totalLastYear: contributions.contributionCalendar.totalContributions,
      commits: contributions.totalCommitContributions,
      pullRequests: contributions.totalPullRequestContributions,
      issues: contributions.totalIssueContributions,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      calendar: contributions.contributionCalendar.weeks,
    },
    mostRecentRepo: mostRecent
      ? { name: mostRecent.name, pushedAt: mostRecent.pushed_at, description: mostRecent.description }
      : null,
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/stats.json", JSON.stringify(stats, null, 2));
  console.log("Wrote data/stats.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
