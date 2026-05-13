import { uiState } from "../state.js"
import { showCustomPopup } from "../utils/utils.js"

// ==========================================
// CONFIG
// ==========================================
const CONCURRENT_LIMIT = 4 // Parallel requests
const TIMEOUT_MS = 8000 // 8s timeout

// ==========================================
// WHITELIST — known trusted domains (skip deep analysis)
// ==========================================
const KNOWN_SAFE_DOMAINS = new Set([
  "google.com", "youtube.com", "facebook.com", "twitter.com", "x.com",
  "instagram.com", "linkedin.com", "github.com", "stackoverflow.com",
  "wikipedia.org", "reddit.com", "amazon.com", "microsoft.com", "apple.com",
  "netflix.com", "spotify.com", "dropbox.com", "notion.so", "figma.com",
  "vercel.app", "netlify.app", "cloudflare.com", "npmjs.com", "medium.com",
  "openai.com", "anthropic.com", "mozilla.org", "w3.org", "w3schools.com",
  "developer.mozilla.org", "docs.google.com", "drive.google.com",
  "gitlab.com", "bitbucket.org", "heroku.com", "digitalocean.com",
  "aws.amazon.com", "azure.microsoft.com", "cloud.google.com",
  "stripe.com", "paypal.com", "shopify.com", "wordpress.com",
  "twitch.tv", "discord.com", "slack.com", "zoom.us", "notion.so",
  "trello.com", "atlassian.com", "jira.com", "confluence.com",
])

// ==========================================
// TOP DOMAINS — for typosquatting detection
// ==========================================
const TOP_DOMAINS = [
  "google", "facebook", "youtube", "amazon", "twitter", "instagram",
  "microsoft", "apple", "netflix", "github", "linkedin", "reddit",
  "wikipedia", "paypal", "ebay", "walmart", "chase", "bankofamerica",
  "wellsfargo", "citibank", "coinbase", "binance", "robinhood",
  "discord", "twitch", "tiktok", "snapchat", "whatsapp", "telegram",
]

// ==========================================
// STEP 1 — Check if URL is alive (fetch HEAD)
// ==========================================
async function checkUrlStatus(url) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      mode: "no-cors",
    })
    clearTimeout(id)
    return true
  } catch {
    clearTimeout(id)
    return false
  }
}

// ==========================================
// STEP 2 — URLhaus malware database check (free, no API key)
// https://urlhaus-api.abuse.ch/
// ==========================================
async function checkURLhaus(url) {
  try {
    const resp = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(url)}`,
      signal: AbortSignal.timeout(6000),
    })
    if (!resp.ok) return "unknown"
    const data = await resp.json()
    // query_status: "is_active" | "inactive" | "not_in_database"
    if (data.query_status === "is_active") return "malware"
    return "clean"
  } catch {
    return "unknown" // API unavailable — skip, don't penalize
  }
}

// ==========================================
// STEP 3 — Heuristic risk analysis
// ==========================================

// Levenshtein distance (for typosquatting detection)
function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

function analyzeUrlRisk(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const full = url.toLowerCase()

    // Strip www.
    const cleanHost = host.replace(/^www\./, "")
    const parts = cleanHost.split(".")
    const tld = parts[parts.length - 1] || ""
    const sld = parts[parts.length - 2] || "" // second-level domain
    const baseDomain = `${sld}.${tld}`

    // Check whitelist — instant safe
    if (KNOWN_SAFE_DOMAINS.has(baseDomain)) return "alive_safe"

    let score = 0

    // ---- Signal 1: No HTTPS ----
    if (u.protocol === "http:") score += 2

    // ---- Signal 2: IP-based URL (direct IP = very suspicious) ----
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) score += 6

    // ---- Signal 3: Punycode / IDN homograph ----
    if (host.includes("xn--")) score += 3

    // ---- Signal 4: Typosquatting detection ----
    let typosquatHit = false
    for (const topDomain of TOP_DOMAINS) {
      // Exact match = fine (already in whitelist or not)
      if (sld === topDomain) break
      const dist = levenshtein(sld, topDomain)
      // Distance 1-2 with similar length = likely typosquat
      if (dist >= 1 && dist <= 2 && Math.abs(sld.length - topDomain.length) <= 2) {
        score += 5
        typosquatHit = true
        break
      }
    }

    // ---- Signal 5: @ in URL (phishing trick) ----
    if (full.includes("@")) score += 5

    // ---- Signal 6: Double encoding or path traversal ----
    if (full.includes("%2f%2f") || full.includes("..") || full.includes("%40")) {
      score += 3
    }

    // ---- Signal 7: Excessive subdomains (> 4 levels) ----
    if (parts.length > 4) score += 2

    // ---- Signal 8: Too many hyphens in domain ----
    const hyphens = (sld.match(/-/g) || []).length
    if (hyphens >= 3) score += 2
    if (hyphens >= 5) score += 2

    // ---- Signal 9: Very long URL ----
    if (url.length > 300) score += 1
    if (url.length > 600) score += 2

    // ---- Signal 10: High-risk TLDs ----
    const highRiskTlds = ["tk", "ml", "ga", "cf", "gq", "pw", "top", "click", "download", "zip", "mov"]
    if (highRiskTlds.includes(tld)) score += 3

    // Medium-risk TLDs
    const medRiskTlds = ["ru", "cn", "xyz", "info", "biz", "link", "online", "site", "win", "loan", "work"]
    if (medRiskTlds.includes(tld)) score += 1

    // ---- Signal 11: Sensitive path keywords (login/verify + multiple params) ----
    const pathLower = u.pathname.toLowerCase() + u.search.toLowerCase()
    const dangerKeywords = ["login", "signin", "verify", "secure", "update", "confirm", "account", "password", "credential", "banking", "wallet"]
    const hits = dangerKeywords.filter((k) => pathLower.includes(k))
    if (hits.length >= 2) score += 2
    if (hits.length >= 3) score += 2

    // ---- Signal 12: Random-looking domain (consonant clusters = not a real word) ----
    if (!typosquatHit) {
      const consonantRun = sld.match(/[bcdfghjklmnpqrstvwxyz]{5,}/i)
      if (consonantRun && sld.length > 6) score += 2
    }

    // ---- Signal 13: Domain contains numbers mixed with letters suspiciously ----
    if (/[a-z]{2,}\d{3,}[a-z]/i.test(sld) || /\d{3,}[a-z]{2,}\d/i.test(sld)) {
      score += 1
    }

    // Threshold: >= 5 = suspicious
    return score >= 5 ? "alive_suspicious" : "alive_safe"
  } catch {
    return "alive_safe"
  }
}

// ==========================================
// MAIN — Check all bookmarks
// ==========================================
export async function checkBrokenLinks(bookmarks, onProgress, onComplete) {
  const targets = bookmarks.filter((b) => b.url && b.url.startsWith("http"))

  if (targets.length === 0) {
    showCustomPopup("No bookmarks to check.", "info")
    return
  }

  if (!uiState.healthStatus) uiState.healthStatus = {}

  let brokenCount = 0

  async function worker(bookmark) {
    // Mark as checking
    uiState.healthStatus[bookmark.id] = "checking"
    onProgress()

    // Step 1: Is it alive?
    const isAlive = await checkUrlStatus(bookmark.url)

    if (!isAlive) {
      uiState.healthStatus[bookmark.id] = "dead"
      brokenCount++
      return
    }

    // Step 2: URLhaus malware check
    const urlhausResult = await checkURLhaus(bookmark.url)
    if (urlhausResult === "malware") {
      uiState.healthStatus[bookmark.id] = "alive_malware"
      brokenCount++
      return
    }

    // Step 3: Heuristic risk analysis
    uiState.healthStatus[bookmark.id] = analyzeUrlRisk(bookmark.url)
  }

  // Concurrency-limited pool
  const queue = [...targets]
  const runPool = async () => {
    const promises = []
    while (queue.length > 0) {
      if (promises.length >= CONCURRENT_LIMIT) {
        await Promise.race(promises)
      }
      const item = queue.shift()
      const p = worker(item).then(() => {
        const idx = promises.indexOf(p)
        if (idx > -1) promises.splice(idx, 1)
        onProgress()
      })
      promises.push(p)
    }
    await Promise.all(promises)
  }

  await runPool()
  onComplete(brokenCount)
}
