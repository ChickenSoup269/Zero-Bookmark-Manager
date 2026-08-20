// components/analyticsDashboard.js
import { uiState } from "./state.js"
import { getFaviconUrl } from "./ui.js"
import { translations } from "./utils/utils.js"
import { openFolderStudio } from "./controller/folderStudio.js"

let currentAnalyticsTab = "overview"

function getLang() {
  const language = localStorage.getItem("appLanguage") || "en"
  return { language, t: translations[language] || translations.en }
}

function flattenTree(nodes) {
  let list = []
  if (!nodes) return list
  for (const node of nodes) {
    if (node.url) list.push(node)
    if (node.children) {
      list = list.concat(flattenTree(node.children))
    }
  }
  return list
}

function getBookmarkDisplayTitle(b) {
  if (b && b.title && b.title.trim()) return b.title.trim()
  if (!b || !b.url) return "Untitled Bookmark"
  try {
    const urlObj = new URL(b.url)
    const host = urlObj.hostname.replace(/^www\./, "")
    const path = urlObj.pathname.length > 1 ? urlObj.pathname : ""
    return decodeURIComponent(host + path)
  } catch (e) {
    return b.url
  }
}

export function initAnalyticsDashboard(elements) {
  const btns = document.querySelectorAll("#analytics-btn, #analytics-btn-menu")
  const popup = document.getElementById("analytics-popup")
  const closeX = document.getElementById("analytics-close-x")
  const closeBtn = document.getElementById("analytics-close")
  const fullscreenBtn = document.getElementById("analytics-fullscreen-btn")
  const popupContent = popup?.querySelector(".analytics-popup-content")

  if (btns.length === 0 || !popup) return

  const closePopup = () => popup.classList.add("hidden")

  if (closeX) closeX.addEventListener("click", closePopup)
  if (closeBtn) closeBtn.addEventListener("click", closePopup)

  if (fullscreenBtn && popupContent) {
    const isWebview = window.location.pathname.endsWith("/bookmarks.html")
    const { t } = getLang()
    fullscreenBtn.title = isWebview
      ? t.fullscreen || "Fullscreen"
      : t.openInFullTab || "Open in Full Tab"

    fullscreenBtn.addEventListener("click", () => {
      if (isWebview) {
        const isFullscreen = popupContent.classList.toggle("is-fullscreen")
        const icon = fullscreenBtn.querySelector("i")
        if (icon) {
          icon.className = isFullscreen ? "fas fa-compress" : "fas fa-expand"
        }
        fullscreenBtn.title = isFullscreen
          ? t.exitFullscreen || "Exit Fullscreen"
          : t.fullscreen || "Fullscreen"
      } else {
        chrome.tabs.create({
          url: chrome.runtime.getURL("bookmarks.html?open=analytics"),
        })
      }
    })
  }

  popup.addEventListener("click", (e) => {
    if (e.target === popup) closePopup()
  })

  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))

      popup.classList.remove("hidden")
      renderAnalyticsDashboard(elements)
    })
  })
}

async function renderAnalyticsDashboard(elements) {
  const container = document.getElementById("analytics-dashboard-container")
  if (!container) return

  const { t } = getLang()

  // Fetch full live bookmark tree from Chrome API
  const tree = await new Promise((res) => chrome.bookmarks.getTree(res))
  const bookmarks = flattenTree(tree).filter(
    (b) => b && b.url && (b.url.startsWith("http://") || b.url.startsWith("https://") || b.url.startsWith("chrome://"))
  )

  const tagsData = await chrome.storage.local.get([
    "bookmarkTags",
    "bookmarkNotes",
    "favoriteBookmarks",
    "pinnedBookmarks",
    "bookmarkHealth",
    "healthStatus",
    "visitCounts",
    "tagColors",
  ])

  const bookmarkTags = tagsData.bookmarkTags || {}
  const bookmarkNotes = tagsData.bookmarkNotes || {}
  const favoriteBookmarks = tagsData.favoriteBookmarks || {}
  const pinnedBookmarks = tagsData.pinnedBookmarks || {}
  const bookmarkHealth = {
    ...(tagsData.bookmarkHealth || {}),
    ...(tagsData.healthStatus || {}),
    ...(uiState.healthStatus || {}),
  }
  const visitCounts = tagsData.visitCounts || uiState.visitCounts || {}
  const tagColors = tagsData.tagColors || {}

  container.innerHTML = `
    <div class="analytics-hub-container">
      <div class="analytics-hub-tabs">
        <button type="button" class="analytics-tab-btn ${currentAnalyticsTab === "overview" ? "active" : ""}" data-tab="overview">
          <i class="fas fa-gauge-high"></i>
          <span>${t.analyticsTabOverview || "Overview"}</span>
        </button>
        <button type="button" class="analytics-tab-btn ${currentAnalyticsTab === "activity" ? "active" : ""}" data-tab="activity">
          <i class="fas fa-chart-column"></i>
          <span>${t.analyticsTabActivity || "Activity & Trends"}</span>
        </button>
        <button type="button" class="analytics-tab-btn ${currentAnalyticsTab === "distribution" ? "active" : ""}" data-tab="distribution">
          <i class="fas fa-tags"></i>
          <span>${t.analyticsTabDistribution || "Domains & Tags"}</span>
        </button>
        <button type="button" class="analytics-tab-btn ${currentAnalyticsTab === "habits" ? "active" : ""}" data-tab="habits">
          <i class="fas fa-fire"></i>
          <span>${t.analyticsTabHabits || "Access Habits"}</span>
        </button>
        <button type="button" class="analytics-tab-btn ${currentAnalyticsTab === "insights" ? "active" : ""}" data-tab="insights">
          <i class="fas fa-lightbulb"></i>
          <span>${t.analyticsTabInsights || "Smart Insights"}</span>
        </button>
      </div>

      <div class="analytics-hub-body" id="analytics-hub-body"></div>
    </div>
  `

  const payload = {
    tree,
    bookmarks,
    bookmarkTags,
    bookmarkNotes,
    favoriteBookmarks,
    pinnedBookmarks,
    bookmarkHealth,
    visitCounts,
    tagColors,
  }

  container.querySelectorAll(".analytics-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentAnalyticsTab = btn.dataset.tab
      container
        .querySelectorAll(".analytics-tab-btn")
        .forEach((b) => b.classList.toggle("active", b === btn))
      renderCurrentAnalyticsTab(elements, payload)
    })
  })

  renderCurrentAnalyticsTab(elements, payload)
}

function countFolders(nodes) {
  let count = 0
  const walk = (items) => {
    for (const node of items) {
      if (!node.url && !String(node.id).startsWith("__smart_") && node.id !== "0") {
        count++
      }
      if (node.children) walk(node.children)
    }
  }
  walk(nodes || [])
  return count
}

function renderCurrentAnalyticsTab(elements, data) {
  const body = document.getElementById("analytics-hub-body")
  if (!body) return

  if (currentAnalyticsTab === "overview") {
    renderOverviewTab(body, data)
  } else if (currentAnalyticsTab === "activity") {
    renderActivityTab(body, data)
  } else if (currentAnalyticsTab === "distribution") {
    renderDistributionTab(body, data)
  } else if (currentAnalyticsTab === "habits") {
    renderHabitsTab(body, data)
  } else if (currentAnalyticsTab === "insights") {
    renderInsightsTab(body, data, elements)
  }

  const popup = document.getElementById("analytics-popup")
  if (popup) popup.scrollTop = 0
  const popupContent = popup?.querySelector(".analytics-popup-content")
  if (popupContent) popupContent.scrollTop = 0
  const tabContent = body.querySelector(".analytics-tab-content")
  if (tabContent) tabContent.scrollTop = 0
}

// ==========================================
// 1. TAB: OVERVIEW METRIC CARDS
// ==========================================
function renderOverviewTab(body, data) {
  const { t } = getLang()
  const { tree, bookmarks, bookmarkTags, bookmarkNotes, favoriteBookmarks, pinnedBookmarks, bookmarkHealth } = data

  const totalBookmarks = bookmarks.length
  const totalFolders = countFolders(tree?.[0]?.children || tree || [])

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const addedThisWeek = bookmarks.filter((b) => (b.dateAdded || 0) >= oneWeekAgo).length
  const addedThisMonth = bookmarks.filter((b) => (b.dateAdded || 0) >= oneMonthAgo).length

  const taggedCount = bookmarks.filter((b) => (bookmarkTags[b.id] || b.tags || []).length > 0).length
  const taggedPercent = totalBookmarks ? Math.round((taggedCount / totalBookmarks) * 100) : 0

  const notesCount = bookmarks.filter((b) => Boolean((bookmarkNotes[b.id] || b.note || "").trim())).length
  const notesPercent = totalBookmarks ? Math.round((notesCount / totalBookmarks) * 100) : 0

  const favoritesCount = bookmarks.filter((b) => favoriteBookmarks[b.id] || b.isFavorite).length
  const pinnedCount = bookmarks.filter((b) => pinnedBookmarks[b.id] || b.isPinned).length

  const httpsCount = bookmarks.filter((b) => b.url && b.url.startsWith("https://")).length
  const httpsPercent = totalBookmarks ? Math.round((httpsCount / totalBookmarks) * 100) : 0

  // Health
  let healthyCount = 0
  let brokenCount = 0
  let uncheckedCount = 0
  bookmarks.forEach((b) => {
    const h = bookmarkHealth[b.id]
    if (!h) {
      uncheckedCount++
    } else {
      const s = typeof h === "string" ? h : (h.status || "")
      if (s === "dead" || s === "broken" || s === "error" || s === "alive_malware") {
        brokenCount++
      } else if (s === "alive_safe" || s === "alive" || s === "ok" || s === "alive_suspicious") {
        healthyCount++
      } else {
        uncheckedCount++
      }
    }
  })

  body.innerHTML = `
    <div class="analytics-tab-content">
      <div class="analytics-metrics-grid">
        <div class="analytics-card metric-card primary-card">
          <div class="metric-icon"><i class="fas fa-bookmark"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsTotalBookmarks || "Total Bookmarks"}</span>
            <strong class="metric-value">${totalBookmarks}</strong>
            <span class="metric-sub">+${addedThisWeek} ${t.analyticsAddedThisWeek || "this week"}</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon folder-icon"><i class="fas fa-folder-tree"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsTotalFolders || "Total Folders"}</span>
            <strong class="metric-value">${totalFolders}</strong>
            <span class="metric-sub">+${addedThisMonth} ${t.analyticsAddedThisMonth || "in past month"}</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon tag-icon"><i class="fas fa-tags"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsTaggedRate || "Tagged"}</span>
            <strong class="metric-value">${taggedPercent}%</strong>
            <span class="metric-sub">${taggedCount} / ${totalBookmarks} ${t.items || "items"}</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon notes-icon"><i class="fas fa-note-sticky"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsNotesRate || "With Notes"}</span>
            <strong class="metric-value">${notesPercent}%</strong>
            <span class="metric-sub">${notesCount} ${t.items || "items"}</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon fav-icon"><i class="fas fa-star"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsFavorites || "Favorites"} / ${t.analyticsPinned || "Pinned"}</span>
            <strong class="metric-value">${favoritesCount} / ${pinnedCount}</strong>
            <span class="metric-sub">${t.quickAccessItems || "Quick access items"}</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon lock-icon"><i class="fas fa-shield-halved"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsSecurityRate || "HTTPS Secure"}</span>
            <strong class="metric-value">${httpsPercent}%</strong>
            <span class="metric-sub">${httpsCount} ${t.secureLinks || "secure links"}</span>
          </div>
        </div>
      </div>

      <!-- Link Health Bar -->
      <div class="analytics-card health-summary-card">
        <div class="health-header" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h4 style="margin: 0;"><i class="fas fa-heart-pulse"></i> ${t.analyticsLinkHealth || "Link Health Status"}</h4>
            <button type="button" class="studio-btn small primary-btn btn-scan-health-now" style="padding: 3px 10px; font-size: 0.76rem; border-radius: 6px;" title="Scan link health">
              <i class="fas fa-rotate"></i> Scan Now
            </button>
          </div>
          <span class="health-badge">${healthyCount} ${t.analyticsHealthHealthy || "Healthy"}, ${brokenCount} ${t.analyticsHealthBroken || "Broken"}, ${uncheckedCount} ${t.analyticsHealthUnchecked || "Unchecked"}</span>
        </div>
        <div class="health-multi-progress" style="margin-top: 10px;">
          <div class="bar-healthy" style="width: ${totalBookmarks ? (healthyCount / totalBookmarks) * 100 : 0}%;" title="${t.analyticsHealthHealthy || "Healthy"}: ${healthyCount}"></div>
          <div class="bar-broken" style="width: ${totalBookmarks ? (brokenCount / totalBookmarks) * 100 : 0}%;" title="${t.analyticsHealthBroken || "Broken"}: ${brokenCount}"></div>
          <div class="bar-unchecked" style="width: ${totalBookmarks ? (uncheckedCount / totalBookmarks) * 100 : 100}%;" title="${t.analyticsHealthUnchecked || "Unchecked"}: ${uncheckedCount}"></div>
        </div>
      </div>
    </div>
  `

  body.querySelector(".btn-scan-health-now")?.addEventListener("click", () => {
    document.getElementById("analytics-popup")?.classList.add("hidden")
    document.getElementById("check-health-btn")?.click()
  })
}

// ==========================================
// 2. TAB: ACTIVITY & TRENDS (CHARTS)
// ==========================================
function renderActivityTab(body, data) {
  const { t } = getLang()
  const { bookmarks, tree } = data

  // Monthly stats (last 12 months)
  const monthLabels = []
  const monthCounts = []
  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthName = d.toLocaleString("default", { month: "short" })
    monthLabels.push(`${monthName} ${d.getFullYear().toString().slice(2)}`)

    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime()

    const count = bookmarks.filter((b) => (b.dateAdded || 0) >= start && (b.dateAdded || 0) <= end).length
    monthCounts.push(count)
  }

  const maxMonthCount = Math.max(...monthCounts, 1)

  // Day of week stats (i18n)
  const daysOfWeek = [
    t.daySun || "Sun",
    t.dayMon || "Mon",
    t.dayTue || "Tue",
    t.dayWed || "Wed",
    t.dayThu || "Thu",
    t.dayFri || "Fri",
    t.daySat || "Sat",
  ]
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]

  // Time of day stats
  const timeBuckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }

  bookmarks.forEach((b) => {
    if (!b.dateAdded) return
    const date = new Date(b.dateAdded)
    const day = date.getDay()
    dayCounts[day]++

    const hour = date.getHours()
    if (hour >= 6 && hour < 12) timeBuckets.Morning++
    else if (hour >= 12 && hour < 18) timeBuckets.Afternoon++
    else if (hour >= 18 && hour < 24) timeBuckets.Evening++
    else timeBuckets.Night++
  })

  const maxDayCount = Math.max(...dayCounts, 1)

  // Recent 30 additions timeline
  const recentBookmarks = [...bookmarks]
    .filter((b) => Boolean(b.dateAdded))
    .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
    .slice(0, 30)

  body.innerHTML = `
    <div class="analytics-tab-content">
      <!-- 12 Months Bar Chart -->
      <div class="analytics-card chart-card">
        <h4>
          <span class="analytics-card-title-left"><i class="fas fa-chart-simple" style="color: #3B82F6;"></i> ${t.analyticsMonthlyTimeline || "Monthly Additions (Past 12 Months)"}</span>
        </h4>
        <div class="analytics-timeline-chart">
          ${monthCounts
            .map((cnt, idx) => {
              const heightPct = Math.max(8, Math.round((cnt / maxMonthCount) * 100))
              return `
              <div class="timeline-bar-col">
                <span class="bar-count-tooltip">${cnt}</span>
                <div class="timeline-bar-track">
                  <div class="timeline-bar-fill" style="height: ${heightPct}%;"></div>
                </div>
                <span class="timeline-bar-label">${monthLabels[idx]}</span>
              </div>
            `
            })
            .join("")}
        </div>
      </div>

      <!-- Activity by Day & Time -->
      <div class="analytics-grid-two">
        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-calendar-week" style="color: #10B981;"></i> ${t.analyticsDayOfWeek || "Peak Activity by Day of Week"}</span>
          </h4>
          <div class="analytics-day-bars">
            ${daysOfWeek
              .map((dayName, idx) => {
                const cnt = dayCounts[idx]
                const pct = Math.max(4, Math.round((cnt / maxDayCount) * 100))
                return `
                <div class="day-bar-row">
                  <span class="day-label">${dayName}</span>
                  <div class="day-bar-track">
                    <div class="day-bar-fill" style="width: ${pct}%;"></div>
                  </div>
                  <span class="day-count-val">${cnt}</span>
                </div>
              `
              })
              .join("")}
          </div>
        </div>

        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-clock" style="color: #F59E0B;"></i> ${t.analyticsTimeOfDay || "Time of Day Distribution"}</span>
          </h4>
          <div class="time-buckets-grid">
            <div class="time-bucket-item">
              <i class="fas fa-sun" style="color: #F59E0B;"></i>
              <strong>${t.morning || "Morning"} (6-12h)</strong>
              <span>${timeBuckets.Morning} ${t.items || "items"}</span>
            </div>
            <div class="time-bucket-item">
              <i class="fas fa-cloud-sun" style="color: #3B82F6;"></i>
              <strong>${t.afternoon || "Afternoon"} (12-18h)</strong>
              <span>${timeBuckets.Afternoon} ${t.items || "items"}</span>
            </div>
            <div class="time-bucket-item">
              <i class="fas fa-moon" style="color: #8B5CF6;"></i>
              <strong>${t.evening || "Evening"} (18-24h)</strong>
              <span>${timeBuckets.Evening} ${t.items || "items"}</span>
            </div>
            <div class="time-bucket-item">
              <i class="fas fa-star-and-crescent" style="color: #10B981;"></i>
              <strong>${t.night || "Night"} (0-6h)</strong>
              <span>${timeBuckets.Night} ${t.items || "items"}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Additions Log -->
      ${
        recentBookmarks.length > 0
          ? `
        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-clock-rotate-left" style="color: var(--accent-color, #3B82F6);"></i> ${t.recentActivityTimeline || "Recently Added Bookmarks"}</span>
            <span class="analytics-count-badge">${recentBookmarks.length} ${t.items || "items"}</span>
          </h4>
          <div class="analytics-recent-activity-list">
            ${recentBookmarks
              .map((b) => {
                const displayTitle = getBookmarkDisplayTitle(b)
                const rawUrl = b.url || ""
                const iconUrl = getFaviconUrl(rawUrl)
                let cleanDomain = ""
                try {
                  cleanDomain = new URL(rawUrl).hostname.replace(/^www\./, "")
                } catch (e) {
                  cleanDomain = rawUrl
                }
                const dateAddedStr = b.dateAdded ? new Date(b.dateAdded).toLocaleDateString() : "Unknown"
                return `
                <div class="habit-bookmark-row">
                  <div class="habit-bm-main">
                    <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                    <div class="habit-bm-info">
                      <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                      <span class="habit-bm-url" title="${rawUrl}">${cleanDomain}</span>
                    </div>
                  </div>
                  <div class="date-badge">
                    <i class="fas fa-calendar-day"></i>
                    <span>${dateAddedStr}</span>
                  </div>
                </div>
              `
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `
}

// ==========================================
// 3. TAB: DOMAINS & TAGS DISTRIBUTION
// ==========================================
function renderDistributionTab(body, data) {
  const { t } = getLang()
  const { tree, bookmarks, bookmarkTags, tagColors } = data

  // Domain breakdown
  const domains = {}
  bookmarks.forEach((b) => {
    if (!b.url || !b.url.startsWith("http")) return
    try {
      let domain = new URL(b.url).hostname.replace(/^www\./, "")
      if (domain) domains[domain] = (domains[domain] || 0) + 1
    } catch (e) {}
  })

  const topDomains = Object.entries(domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
  const maxDomainCount = topDomains[0]?.[1] || 1

  // Tags breakdown
  const tagCounts = {}
  Object.values(bookmarkTags).forEach((tags) => {
    if (Array.isArray(tags)) {
      tags.forEach((tag) => {
        if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)

  // Robust Folder breakdown
  const folderCounts = []
  function countFolderItems(node) {
    let total = 0
    if (!node || !node.children) return 0
    for (const c of node.children) {
      if (c.url) total++
      if (c.children) total += countFolderItems(c)
    }
    return total
  }

  function walkFolders(node, currentPath = "") {
    if (!node) return
    if (node.id === "0") {
      ;(node.children || []).forEach((c) => walkFolders(c, ""))
      return
    }
    if (node.children) {
      let folderTitle = node.title
      if (!folderTitle) {
        if (node.id === "1") folderTitle = "Bookmarks Bar"
        else if (node.id === "2") folderTitle = "Other Bookmarks"
        else if (node.id === "3") folderTitle = "Mobile Bookmarks"
        else folderTitle = "Folder"
      }
      const p = currentPath ? `${currentPath} / ${folderTitle}` : folderTitle
      const totalCount = countFolderItems(node)

      folderCounts.push({
        id: node.id,
        name: folderTitle,
        path: p,
        count: totalCount,
      })

      node.children.forEach((c) => {
        if (c.children) walkFolders(c, p)
      })
    }
  }

  if (tree && tree[0]) {
    walkFolders(tree[0], "")
  }

  const topFolders = folderCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 60)

  body.innerHTML = `
    <div class="analytics-tab-content">
      <div class="analytics-grid-two">
        <!-- Top Domains -->
        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-globe" style="color: #3B82F6;"></i> ${t.analyticsTopDomains || "Top Domains"}</span>
            <span class="analytics-count-badge">${topDomains.length} ${t.items || "domains"}</span>
          </h4>
          <div class="analytics-domain-list">
            ${
              topDomains.length === 0
                ? `<div class="analytics-empty">${t.noDomainData || "No domain data yet"}</div>`
                : topDomains
                    .map(([domain, count]) => {
                      const pct = Math.max(6, Math.round((count / maxDomainCount) * 100))
                      const iconUrl = getFaviconUrl("https://" + domain)
                      return `
                  <div class="domain-item-row">
                    <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                    <div class="domain-info-bar">
                      <div class="domain-name-row">
                        <span class="domain-name" title="${domain}">${domain}</span>
                        <span class="domain-count">${count}</span>
                      </div>
                      <div class="domain-progress-track">
                        <div class="domain-progress-fill" style="width: ${pct}%;"></div>
                      </div>
                    </div>
                  </div>
                `
                    })
                    .join("")
            }
          </div>
        </div>

        <!-- Top Tags -->
        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-tags" style="color: #10B981;"></i> ${t.analyticsTopTags || "Top Used Tags"}</span>
            <span class="analytics-count-badge">${topTags.length} ${t.items || "tags"}</span>
          </h4>
          <div class="analytics-tags-cloud">
            ${
              topTags.length === 0
                ? `<div class="analytics-empty">${t.noTagsUsed || "No tags used yet"}</div>`
                : topTags
                    .map(([tag, count]) => {
                      const color = tagColors[tag] || "var(--accent-color)"
                      return `
                  <div class="analytics-tag-pill" style="border: 1px solid ${color};">
                    <span class="tag-name" style="color: ${color};">#${tag}</span>
                    <span class="tag-badge" style="background: ${color}; color: #ffffff;">${count}</span>
                  </div>
                `
                    })
                    .join("")
            }
          </div>
        </div>
      </div>

      <!-- Top Folders -->
      <div class="analytics-card">
        <h4>
          <span class="analytics-card-title-left"><i class="fas fa-folder-open" style="color: var(--accent-color);"></i> ${t.analyticsLargestFolders || "Largest Folders by Items"}</span>
          <span class="analytics-count-badge">${topFolders.length} ${t.items || "folders"}</span>
        </h4>
        <div class="analytics-folders-grid">
          ${
            topFolders.length === 0
              ? `<div class="analytics-empty">${t.noFoldersFound || "No folders found"}</div>`
              : topFolders
                  .map(
                    (f) => `
                <div class="analytics-folder-item">
                  <i class="fas fa-folder"></i>
                  <div class="folder-details">
                    <strong title="${f.name}">${f.name}</strong>
                    <span title="${f.path}">${f.path}</span>
                  </div>
                  <span class="folder-count-badge">${f.count} ${t.items || "items"}</span>
                </div>
              `,
                  )
                  .join("")
          }
        </div>
      </div>
    </div>
  `
}

// ==========================================
// 4. TAB: HABITS & FORGOTTEN BOOKMARKS
// ==========================================
function renderHabitsTab(body, data) {
  const { t } = getLang()
  const { bookmarks, visitCounts } = data

  // Most visited
  const visitedList = bookmarks
    .map((b) => ({ ...b, visits: visitCounts[b.id] || b.accessCount || 0 }))
    .filter((b) => b.visits > 0)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 50)

  // Fallback if no visit counts recorded yet: Show recent bookmarks with visit hint
  const recentBookmarksFallback = [...bookmarks]
    .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
    .slice(0, 30)

  // Stale / Forgotten (> 180 days ago)
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000
  let staleBookmarks = bookmarks
    .filter((b) => (b.dateAdded || 0) < sixMonthsAgo && (visitCounts[b.id] || 0) === 0)
    .slice(0, 50)

  if (staleBookmarks.length === 0 && bookmarks.length > 0) {
    // If no bookmarks > 6 months, pick oldest saved bookmarks
    staleBookmarks = [...bookmarks]
      .sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))
      .slice(0, 30)
  }

  body.innerHTML = `
    <div class="analytics-tab-content">
      <div class="analytics-grid-two">
        <!-- Most Visited -->
        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-fire-flame-curved" style="color: var(--accent-color, #3B82F6);"></i> ${t.analyticsMostVisited || "Most Visited Bookmarks"}</span>
            <span class="analytics-count-badge">${visitedList.length > 0 ? visitedList.length : recentBookmarksFallback.length} ${t.items || "items"}</span>
          </h4>
          <div class="analytics-visited-list">
            ${
              visitedList.length === 0
                ? `
                <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 6px;">
                  <i class="fas fa-info-circle" style="color: var(--accent-color); margin-right: 4px;"></i>
                  ${t.visitTrackingHint || "Click open bookmarks to record visit counts. Recent bookmarks shown below:"}
                </div>
                ${recentBookmarksFallback
                  .map((b, idx) => {
                    const displayTitle = getBookmarkDisplayTitle(b)
                    const rawUrl = b.url || ""
                    const iconUrl = getFaviconUrl(rawUrl)
                    let cleanDomain = ""
                    try {
                      cleanDomain = new URL(rawUrl).hostname.replace(/^www\./, "")
                    } catch (e) {
                      cleanDomain = rawUrl
                    }
                    return `
                  <div class="habit-bookmark-row">
                    <div class="habit-bm-main">
                      <span class="habit-rank-badge rank-${idx + 1}">${idx + 1}</span>
                      <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                      <div class="habit-bm-info">
                        <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                        <span class="habit-bm-url" title="${rawUrl}">${cleanDomain}</span>
                      </div>
                    </div>
                  </div>
                `
                  })
                  .join("")}
              `
                : visitedList
                    .map((b, idx) => {
                      const displayTitle = getBookmarkDisplayTitle(b)
                      const rawUrl = b.url || ""
                      const iconUrl = getFaviconUrl(rawUrl)
                      let cleanDomain = ""
                      try {
                        cleanDomain = new URL(rawUrl).hostname.replace(/^www\./, "")
                      } catch (e) {
                        cleanDomain = rawUrl
                      }
                      return `
                  <div class="habit-bookmark-row">
                    <div class="habit-bm-main">
                      <span class="habit-rank-badge rank-${idx + 1}">${idx + 1}</span>
                      <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                      <div class="habit-bm-info">
                        <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                        <span class="habit-bm-url" title="${rawUrl}">${cleanDomain}</span>
                      </div>
                    </div>
                    <div class="visit-badge">
                      <i class="fas fa-fire-flame-curved"></i>
                      <span>${b.visits} ${t.visits || "views"}</span>
                    </div>
                  </div>
                `
                    })
                    .join("")
            }
          </div>
        </div>

        <!-- Forgotten Bookmarks -->
        <div class="analytics-card">
          <h4>
            <span class="analytics-card-title-left"><i class="fas fa-box-archive" style="color: #8B5CF6;"></i> ${t.analyticsStaleBookmarks || "Forgotten Bookmarks (> 6 months)"}</span>
            <span class="analytics-count-badge">${staleBookmarks.length} ${t.items || "items"}</span>
          </h4>
          <div class="analytics-visited-list">
            ${
              staleBookmarks.length === 0
                ? `<div class="analytics-empty">${t.noForgottenBookmarks || "No forgotten bookmarks found!"}</div>`
                : staleBookmarks
                    .map((b) => {
                      const displayTitle = getBookmarkDisplayTitle(b)
                      const rawUrl = b.url || ""
                      const iconUrl = getFaviconUrl(rawUrl)
                      let cleanDomain = ""
                      try {
                        cleanDomain = new URL(rawUrl).hostname.replace(/^www\./, "")
                      } catch (e) {
                        cleanDomain = rawUrl
                      }
                      const dateAddedStr = b.dateAdded ? new Date(b.dateAdded).toLocaleDateString() : "Unknown"
                      return `
                  <div class="habit-bookmark-row">
                    <div class="habit-bm-main">
                      <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                      <div class="habit-bm-info">
                        <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                        <span class="habit-bm-url" title="${rawUrl}">${cleanDomain}</span>
                      </div>
                    </div>
                    <div class="stale-date-badge">
                      <i class="fas fa-calendar-xmark"></i>
                      <span>${t.savedOn || "Saved"}: ${dateAddedStr}</span>
                    </div>
                  </div>
                `
                    })
                    .join("")
            }
          </div>
        </div>
      </div>
    </div>
  `
}

// ==========================================
// 5. TAB: SMART INSIGHTS & RECOMMENDATIONS
// ==========================================
function renderInsightsTab(body, data, elements) {
  const { t } = getLang()
  const { bookmarks, bookmarkTags, bookmarkHealth } = data

  const untagged = bookmarks.filter((b) => !(bookmarkTags[b.id] && bookmarkTags[b.id].length > 0))
  const unsorted = bookmarks.filter((b) => b.parentId === "1" || b.parentId === "0" || !b.parentId)

  let brokenCount = 0
  bookmarks.forEach((b) => {
    const h = bookmarkHealth[b.id]
    if (h) {
      const s = typeof h === "string" ? h : (h.status || "")
      if (s === "dead" || s === "broken" || s === "error" || s === "alive_malware") {
        brokenCount++
      }
    }
  })

  const hasIssues = untagged.length > 5 || unsorted.length > 5 || brokenCount > 0

  body.innerHTML = `
    <div class="analytics-tab-content">
      <div class="analytics-card">
        <h4><i class="fas fa-wand-magic-sparkles"></i> ${t.analyticsInsightsTitle || "Smart Recommendations"}</h4>
        
        <div class="analytics-insights-container">
          ${
            !hasIssues
              ? `
            <div class="insight-pristine-state">
              <i class="fas fa-sparkles" style="font-size: 2.2rem; color: #10B981; margin-bottom: 10px;"></i>
              <p>${t.analyticsInsightGreatJob || "Your bookmark library is in pristine condition! No optimization needed."}</p>
            </div>
          `
              : `
            ${
              untagged.length > 0
                ? `
              <div class="insight-banner">
                <div class="insight-icon"><i class="fas fa-tags" style="color: #F59E0B;"></i></div>
                <div class="insight-text">
                  <strong>${untagged.length} ${t.analyticsInsightUntagged || "bookmarks have no tags assigned."}</strong>
                  <p>${t.insightTagsDesc || "Organizing with tags makes searching instant and flexible."}</p>
                </div>
                <button type="button" class="studio-btn primary-btn small btn-action-suggest-tags">
                  ${t.analyticsInsightUntaggedAction || "Suggest Tags"}
                </button>
              </div>
            `
                : ""
            }

            ${
              unsorted.length > 0
                ? `
              <div class="insight-banner">
                <div class="insight-icon"><i class="fas fa-folder-tree" style="color: #3B82F6;"></i></div>
                <div class="insight-text">
                  <strong>${unsorted.length} ${t.analyticsInsightUnsorted || "bookmarks are sitting in root without a folder."}</strong>
                  <p>${t.insightFoldersDesc || "Group related bookmarks into subfolders for a tidy hierarchy."}</p>
                </div>
                <button type="button" class="studio-btn primary-btn small btn-action-open-studio">
                  ${t.analyticsInsightUnsortedAction || "Organize Folders"}
                </button>
              </div>
            `
                : ""
            }

            ${
              brokenCount > 0
                ? `
              <div class="insight-banner danger-banner">
                <div class="insight-icon"><i class="fas fa-link-slash" style="color: #EF4444;"></i></div>
                <div class="insight-text">
                  <strong>${brokenCount} ${t.analyticsInsightBroken || "broken links detected."}</strong>
                  <p>${t.insightHealthDesc || "Clean dead links to keep your library healthy and fast."}</p>
                </div>
                <button type="button" class="studio-btn danger-btn small btn-action-open-cleanup">
                  ${t.analyticsInsightBrokenAction || "Run Health Cleanup"}
                </button>
              </div>
            `
                : ""
            }
          `
          }
        </div>
      </div>
    </div>
  `

  body.querySelector(".btn-action-open-studio")?.addEventListener("click", () => {
    document.getElementById("analytics-popup")?.classList.add("hidden")
    openFolderStudio(elements)
  })

  body.querySelector(".btn-action-open-cleanup")?.addEventListener("click", () => {
    document.getElementById("analytics-popup")?.classList.add("hidden")
    document.getElementById("smart-cleanup-button")?.click()
  })

  body.querySelector(".btn-action-suggest-tags")?.addEventListener("click", () => {
    document.getElementById("analytics-popup")?.classList.add("hidden")
    document.getElementById("smart-cleanup-button")?.click()
  })
}
