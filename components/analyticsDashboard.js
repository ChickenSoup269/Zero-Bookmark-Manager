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

    btns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            // Close other dropdowns
            document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.add("hidden"));
        
        // Open popup
        popup.classList.remove("hidden");
        
        // Apply current theme
        const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
        const allThemes = ["light", "dark", "dracula", "onedark", "tet"];
        allThemes.forEach(theme => popup.classList.remove(`${theme}-theme`));
        popup.classList.add(`${currentTheme}-theme`);
        
        // Calculate stats
        const bookmarks = uiState.bookmarks || [];
        const totalBookmarks = bookmarks.length;
        
        window.BookmarkCache.getTree(tree => {
            let folderCount = 0;
            const countFolders = (nodes) => {
                for (let node of nodes) {
                    if (!node.url && !node.id.startsWith('__smart_')) {
                        folderCount++;
                    }
                    if (node.children) countFolders(node.children);
                }
            };
            if (tree && tree.length) countFolders(tree[0].children || []);
            
            document.getElementById("stat-total-folders").textContent = folderCount;
        });

        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentBookmarks = bookmarks.filter(b => b.dateAdded >= oneWeekAgo).length;

        document.getElementById("stat-total-bookmarks").textContent = totalBookmarks;
        document.getElementById("stat-recent-bookmarks").textContent = recentBookmarks;

        // Domain analysis
        const domains = {};
        bookmarks.forEach(b => {
            if (!b.url) return;
            try {
                const urlObj = new URL(b.url);
                let domain = urlObj.hostname.replace(/^www\./, '');
                domains[domain] = (domains[domain] || 0) + 1;
            } catch (e) {}
        });

        const topDomains = Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const domainsContainer = document.getElementById("stat-top-domains");
        domainsContainer.innerHTML = '';
        
        if (topDomains.length === 0) {
            domainsContainer.innerHTML = '<div style="color: var(--text-secondary);">Not enough data.</div>';
            return;
        }

        const maxCount = topDomains[0][1];

        topDomains.forEach(([domain, count]) => {
            const percentage = Math.max(5, (count / maxCount) * 100);
            const iconUrl = getFaviconUrl("https://" + domain);
            
            const barHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${iconUrl}" style="width:16px;height:16px;border-radius:4px;" onerror="this.src='images/default-favicon.png'"/>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
                            <span style="color: var(--text-primary); font-weight: 600;">${domain}</span>
                            <span style="color: var(--text-secondary);">${count}</span>
                        </div>
                        <div style="height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${percentage}%; background: var(--accent-color); border-radius: 4px; transition: width 0.5s ease-out;"></div>
                        </div>
                    </div>
                </div>
            `;
            domainsContainer.insertAdjacentHTML('beforeend', barHTML);
        });
    });
    });
}
