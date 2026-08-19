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
    "visitCounts",
    "tagColors",
  ])

  const bookmarkTags = tagsData.bookmarkTags || {}
  const bookmarkNotes = tagsData.bookmarkNotes || {}
  const favoriteBookmarks = tagsData.favoriteBookmarks || {}
  const pinnedBookmarks = tagsData.pinnedBookmarks || {}
  const bookmarkHealth = tagsData.bookmarkHealth || {}
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
    if (!h || h.status === "unchecked") uncheckedCount++
    else if (h.status === "alive" || h.status === "ok") healthyCount++
    else brokenCount++
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
            <span class="metric-sub">${taggedCount} / ${totalBookmarks} items</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon notes-icon"><i class="fas fa-note-sticky"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsNotesRate || "With Notes"}</span>
            <strong class="metric-value">${notesPercent}%</strong>
            <span class="metric-sub">${notesCount} items</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon fav-icon"><i class="fas fa-star"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsFavorites || "Favorites"} / ${t.analyticsPinned || "Pinned"}</span>
            <strong class="metric-value">${favoritesCount} / ${pinnedCount}</strong>
            <span class="metric-sub">Quick access items</span>
          </div>
        </div>

        <div class="analytics-card metric-card">
          <div class="metric-icon lock-icon"><i class="fas fa-shield-halved"></i></div>
          <div class="metric-info">
            <span class="metric-label">${t.analyticsSecurityRate || "HTTPS Secure"}</span>
            <strong class="metric-value">${httpsPercent}%</strong>
            <span class="metric-sub">${httpsCount} secure links</span>
          </div>
        </div>
      </div>

      <!-- Link Health Bar -->
      <div class="analytics-card health-summary-card">
        <div class="health-header">
          <h4><i class="fas fa-heart-pulse"></i> ${t.analyticsLinkHealth || "Link Health Status"}</h4>
          <span class="health-badge">${healthyCount} Healthy, ${brokenCount} Broken, ${uncheckedCount} Unchecked</span>
        </div>
        <div class="health-multi-progress">
          <div class="bar-healthy" style="width: ${totalBookmarks ? (healthyCount / totalBookmarks) * 100 : 0}%;" title="Healthy: ${healthyCount}"></div>
          <div class="bar-broken" style="width: ${totalBookmarks ? (brokenCount / totalBookmarks) * 100 : 0}%;" title="Broken: ${brokenCount}"></div>
          <div class="bar-unchecked" style="width: ${totalBookmarks ? (uncheckedCount / totalBookmarks) * 100 : 100}%;" title="Unchecked: ${uncheckedCount}"></div>
        </div>
      </div>
    </div>
  `
}

// ==========================================
// 2. TAB: ACTIVITY & TRENDS (CHARTS)
// ==========================================
function renderActivityTab(body, data) {
  const { t } = getLang()
  const { bookmarks } = data

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

  // Day of week stats
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
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

  body.innerHTML = `
    <div class="analytics-tab-content">
      <!-- 12 Months Bar Chart -->
      <div class="analytics-card chart-card">
        <h4><i class="fas fa-chart-simple"></i> ${t.analyticsMonthlyTimeline || "Monthly Additions (Past 12 Months)"}</h4>
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
          <h4><i class="fas fa-calendar-week"></i> ${t.analyticsDayOfWeek || "Peak Activity by Day of Week"}</h4>
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
          <h4><i class="fas fa-clock"></i> Time of Day Distribution</h4>
          <div class="time-buckets-grid">
            <div class="time-bucket-item">
              <i class="fas fa-sun" style="color: #F59E0B;"></i>
              <strong>Morning (6-12h)</strong>
              <span>${timeBuckets.Morning} items</span>
            </div>
            <div class="time-bucket-item">
              <i class="fas fa-cloud-sun" style="color: #3B82F6;"></i>
              <strong>Afternoon (12-18h)</strong>
              <span>${timeBuckets.Afternoon} items</span>
            </div>
            <div class="time-bucket-item">
              <i class="fas fa-moon" style="color: #8B5CF6;"></i>
              <strong>Evening (18-24h)</strong>
              <span>${timeBuckets.Evening} items</span>
            </div>
            <div class="time-bucket-item">
              <i class="fas fa-star-and-crescent" style="color: #10B981;"></i>
              <strong>Night (0-6h)</strong>
              <span>${timeBuckets.Night} items</span>
            </div>
          </div>
        </div>
      </div>
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
    .slice(0, 8)
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
    .slice(0, 15)

  // Robust Folder breakdown
  const folderCounts = []
  function walkFolders(node, currentPath = "") {
    if (!node) return
    if (node.id === "0") {
      (node.children || []).forEach((c) => walkFolders(c, ""))
      return
    }
    if (node.children) {
      const directBms = node.children.filter((c) => c.url).length
      let folderTitle = node.title
      if (!folderTitle) {
        if (node.id === "1") folderTitle = "Bookmarks Bar"
        else if (node.id === "2") folderTitle = "Other Bookmarks"
        else if (node.id === "3") folderTitle = "Mobile Bookmarks"
        else folderTitle = "Folder"
      }
      const p = currentPath ? `${currentPath} / ${folderTitle}` : folderTitle

      folderCounts.push({
        id: node.id,
        name: folderTitle,
        path: p,
        count: directBms,
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
    .slice(0, 8)

  body.innerHTML = `
    <div class="analytics-tab-content">
      <div class="analytics-grid-two">
        <!-- Top Domains -->
        <div class="analytics-card">
          <h4><i class="fas fa-globe"></i> ${t.analyticsTopDomains || "Top Domains"}</h4>
          <div class="analytics-domain-list">
            ${
              topDomains.length === 0
                ? '<div class="analytics-empty">No domain data yet</div>'
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
          <h4><i class="fas fa-tags"></i> ${t.analyticsTopTags || "Top Used Tags"}</h4>
          <div class="analytics-tags-cloud">
            ${
              topTags.length === 0
                ? '<div class="analytics-empty">No tags used yet</div>'
                : topTags
                    .map(([tag, count]) => {
                      const color = tagColors[tag] || "var(--accent-color)"
                      return `
                  <div class="analytics-tag-pill" style="border-left: 4px solid ${color};">
                    <span class="tag-name">#${tag}</span>
                    <span class="tag-badge">${count}</span>
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
        <h4><i class="fas fa-folder-open"></i> ${t.analyticsLargestFolders || "Largest Folders by Items"}</h4>
        <div class="analytics-folders-grid">
          ${
            topFolders.length === 0
              ? '<div class="analytics-empty">No folders found</div>'
              : topFolders
                  .map(
                    (f) => `
                <div class="analytics-folder-item">
                  <i class="fas fa-folder"></i>
                  <div class="folder-details">
                    <strong title="${f.name}">${f.name}</strong>
                    <span title="${f.path}">${f.path}</span>
                  </div>
                  <span class="folder-count-badge">${f.count} items</span>
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
    .slice(0, 8)

  // Fallback if no visit counts recorded yet: Show recent bookmarks with visit hint
  const recentBookmarksFallback = [...bookmarks]
    .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
    .slice(0, 8)

  // Stale / Forgotten (> 180 days ago)
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000
  let staleBookmarks = bookmarks
    .filter((b) => (b.dateAdded || 0) < sixMonthsAgo && (visitCounts[b.id] || 0) === 0)
    .slice(0, 8)

  if (staleBookmarks.length === 0 && bookmarks.length > 0) {
    // If no bookmarks > 6 months, pick oldest saved bookmarks
    staleBookmarks = [...bookmarks]
      .sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))
      .slice(0, 6)
  }

  body.innerHTML = `
    <div class="analytics-tab-content">
      <div class="analytics-grid-two">
        <!-- Most Visited -->
        <div class="analytics-card">
          <h4><i class="fas fa-fire" style="color: #EF4444;"></i> ${t.analyticsMostVisited || "Most Visited Bookmarks"}</h4>
          <div class="analytics-visited-list">
            ${
              visitedList.length === 0
                ? `
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
                  <i class="fas fa-info-circle" style="color: var(--accent-color); margin-right: 4px;"></i>
                  ${t.visitTrackingHint || "Click open bookmarks to record visit counts. Recent bookmarks shown below:"}
                </div>
                ${recentBookmarksFallback
                  .map((b) => {
                    const displayTitle = getBookmarkDisplayTitle(b)
                    const rawUrl = b.url || ""
                    const iconUrl = getFaviconUrl(rawUrl)
                    return `
                  <div class="habit-bookmark-row">
                    <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                    <div class="habit-bm-info">
                      <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                      <span class="habit-bm-url" title="${rawUrl}">${rawUrl}</span>
                    </div>
                  </div>
                `
                  })
                  .join("")}
              `
                : visitedList
                    .map((b) => {
                      const displayTitle = getBookmarkDisplayTitle(b)
                      const rawUrl = b.url || ""
                      const iconUrl = getFaviconUrl(rawUrl)
                      return `
                  <div class="habit-bookmark-row">
                    <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                    <div class="habit-bm-info">
                      <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                      <span class="habit-bm-url" title="${rawUrl}">${rawUrl}</span>
                    </div>
                    <span class="visit-badge">${b.visits} visits</span>
                  </div>
                `
                    })
                    .join("")
            }
          </div>
        </div>

        <!-- Forgotten Bookmarks -->
        <div class="analytics-card">
          <h4><i class="fas fa-box-archive" style="color: #8B5CF6;"></i> ${t.analyticsStaleBookmarks || "Forgotten Bookmarks (> 6 months)"}</h4>
          <div class="analytics-visited-list">
            ${
              staleBookmarks.length === 0
                ? '<div class="analytics-empty">No forgotten bookmarks found!</div>'
                : staleBookmarks
                    .map((b) => {
                      const displayTitle = getBookmarkDisplayTitle(b)
                      const rawUrl = b.url || ""
                      const iconUrl = getFaviconUrl(rawUrl)
                      const dateAddedStr = b.dateAdded ? new Date(b.dateAdded).toLocaleDateString() : "Unknown"
                      return `
                  <div class="habit-bookmark-row">
                    <img src="${iconUrl}" class="analytics-favicon" onerror="this.src='images/default-favicon.png'" />
                    <div class="habit-bm-info">
                      <a href="${rawUrl}" target="_blank" class="habit-bm-title" title="${displayTitle}">${displayTitle}</a>
                      <span class="habit-bm-url" title="${rawUrl} (Saved on: ${dateAddedStr})">Saved: ${dateAddedStr}</span>
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
    if (h && (h.status === "broken" || h.status === "error" || h.status === "dead")) {
      brokenCount++
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
              <i class="fas fa-sparkles" style="font-size: 2.5rem; color: #10B981; margin-bottom: 12px;"></i>
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
                  <p>Organizing with tags makes searching instant and flexible.</p>
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
                  <p>Group related bookmarks into subfolders for a tidy hierarchy.</p>
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
                  <p>Clean dead links to keep your library healthy and fast.</p>
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
