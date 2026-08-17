import { uiState } from "./state.js";
import { getFaviconUrl } from "./ui.js";

export function initAnalyticsDashboard(elements) {
  const btns = document.querySelectorAll("#analytics-btn, #analytics-btn-menu");
  const popup = document.getElementById("analytics-popup");
  const closeX = document.getElementById("analytics-close-x");
  const closeBtn = document.getElementById("analytics-close");

  if (btns.length === 0 || !popup) return;

  const closePopup = () => popup.classList.add("hidden");

  if (closeX) closeX.addEventListener("click", closePopup);
  if (closeBtn) closeBtn.addEventListener("click", closePopup);
  popup.addEventListener("click", (e) => {
    if (e.target === popup) closePopup();
  });

  const renderStats = () => {
    try {
      // Calculate stats
      const bookmarks = uiState.bookmarks || [];
      const totalBookmarks = bookmarks.length;

      const countFolders = (nodes) => {
        let count = 0;
        const walk = (items) => {
          for (let node of items) {
            if (!node.url && !String(node.id).startsWith("__smart_")) {
              count++;
            }
            if (node.children) walk(node.children);
          }
        };
        walk(nodes || []);
        return count;
      };

      const updateFolderCount = (tree) => {
        const rootChildren = tree?.[0]?.children || tree || [];
        const folderCount = countFolders(rootChildren);
        const folderEl = document.getElementById("stat-total-folders");
        if (folderEl) folderEl.textContent = folderCount;
      };

      if (window.BookmarkCache?.getTree) {
        window.BookmarkCache.getTree((tree) => updateFolderCount(tree));
      } else {
        updateFolderCount(uiState.bookmarkTree);
      }

      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentBookmarks = bookmarks.filter(
        (b) => (b.dateAdded || 0) >= oneWeekAgo,
      ).length;

      const totalEl = document.getElementById("stat-total-bookmarks");
      if (totalEl) totalEl.textContent = totalBookmarks;

      const recentEl = document.getElementById("stat-recent-bookmarks");
      if (recentEl) recentEl.textContent = recentBookmarks;

      // Domain analysis
      const domains = {};
      for (let i = 0; i < bookmarks.length; i++) {
        const b = bookmarks[i];
        if (!b.url || !b.url.startsWith("http")) continue;
        try {
          const slashIdx = b.url.indexOf("://");
          if (slashIdx !== -1) {
            const start = slashIdx + 3;
            const end = b.url.indexOf("/", start);
            let domain = end !== -1 ? b.url.slice(start, end) : b.url.slice(start);
            const colonIdx = domain.indexOf(":");
            if (colonIdx !== -1) domain = domain.slice(0, colonIdx);
            if (domain.startsWith("www.")) domain = domain.slice(4);
            if (domain) domains[domain] = (domains[domain] || 0) + 1;
          } else {
            let domain = new URL(b.url).hostname.replace(/^www\./, "");
            if (domain) domains[domain] = (domains[domain] || 0) + 1;
          }
        } catch (e) {}
      }

      const topDomains = Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const domainsContainer = document.getElementById("stat-top-domains");
      if (domainsContainer) {
        domainsContainer.innerHTML = "";

        if (topDomains.length === 0) {
          domainsContainer.innerHTML =
            '<div style="color: var(--text-secondary); padding: 8px 0;">Not enough data.</div>';
          return;
        }

        const maxCount = topDomains[0][1] || 1;

        topDomains.forEach(([domain, count]) => {
          const percentage = Math.max(5, (count / maxCount) * 100);
          const iconUrl = getFaviconUrl("https://" + domain);

          const barHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${iconUrl}" style="width:16px;height:16px;border-radius:4px;flex-shrink:0;" onerror="this.src='images/default-favicon.png'"/>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
                  <span style="color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${domain}</span>
                  <span style="color: var(--text-secondary); margin-left: 8px; flex-shrink: 0;">${count}</span>
                </div>
                <div style="height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${percentage}%; background: var(--accent-color); border-radius: 4px; transition: width 0.5s ease-out;"></div>
                </div>
              </div>
            </div>
          `;
          domainsContainer.insertAdjacentHTML("beforeend", barHTML);
        });
      }
    } catch (err) {
      console.error("Error rendering analytics:", err);
    }
  };

  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other dropdowns
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"));

      // Open popup
      popup.classList.remove("hidden");
      renderStats();
    });
  });
}
