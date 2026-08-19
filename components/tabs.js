document.addEventListener("DOMContentLoaded", () => {
    const tabDashboard = document.getElementById("tab-dashboard");
    const tabQuickSave = document.getElementById("tab-quick-save");
    const dashboardView = document.getElementById("dashboard-view");
    const quickSaveView = document.getElementById("quick-save-view");
    const quickSaveFrame = document.getElementById("quick-save-frame");

    let iframeLoaded = false;

    async function getActiveTabId() {
        const urlParams = new URLSearchParams(window.location.search);
        const paramTabId = urlParams.get('tabId');
        if (paramTabId) return Number(paramTabId);

        if (typeof chrome === "undefined" || !chrome.tabs) return null;

        // Strategy 1: query active tab with lastFocusedWindow
        try {
            const tabs = await new Promise((resolve) => {
                chrome.tabs.query({ active: true, lastFocusedWindow: true }, (res) => {
                    if (chrome.runtime.lastError || !res || !res.length) resolve([]);
                    else resolve(res);
                });
            });
            const valid = tabs.filter(t => t.url && !/^(chrome|edge|about|chrome-extension):\/\//i.test(t.url));
            if (valid.length > 0) return valid[0].id;
            if (tabs.length > 0) return tabs[0].id;
        } catch (e) {}

        // Strategy 2: getLastFocused with populate
        try {
            const win = await new Promise((resolve) => {
                chrome.windows.getLastFocused({ populate: true }, (w) => {
                    if (chrome.runtime.lastError || !w) resolve(null);
                    else resolve(w);
                });
            });
            if (win && win.tabs) {
                const activeTab = win.tabs.find(t => t.active);
                if (activeTab) return activeTab.id;
            }
        } catch (e) {}

        // Strategy 3: normal windows
        try {
            const wins = await new Promise((resolve) => {
                chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (w) => {
                    if (chrome.runtime.lastError || !w) resolve([]);
                    else resolve(w);
                });
            });
            const focusedWin = wins.find(w => w.focused) || wins[0];
            if (focusedWin && focusedWin.tabs) {
                const activeTab = focusedWin.tabs.find(t => t.active);
                if (activeTab) return activeTab.id;
            }
        } catch (e) {}

        return null;
    }

    async function getQuickSaveSrc() {
        const tabId = await getActiveTabId();
        if (tabId) {
            return `quick-save.html?embedded=true&tabId=${tabId}`;
        }
        return `quick-save.html?embedded=true`;
    }

    const footer = document.querySelector(".footer");

    function switchTab(tab) {
        localStorage.setItem("activeTab", tab);

        if (tab === "dashboard") {
            tabDashboard.classList.add("active");
            tabQuickSave.classList.remove("active");
            dashboardView.style.display = "flex";
            quickSaveView.style.display = "none";
            if (footer) footer.style.display = "";
        } else if (tab === "quick-save") {
            tabQuickSave.classList.add("active");
            tabDashboard.classList.remove("active");
            quickSaveView.style.display = "flex";
            dashboardView.style.display = "none";
            if (footer) footer.style.display = "none";

            // Lazy-load iframe src on first activation, or refresh tab info if already loaded
            if (quickSaveFrame) {
                if (!iframeLoaded) {
                    iframeLoaded = true;
                    getQuickSaveSrc().then(src => {
                        quickSaveFrame.src = src;
                    });
                } else {
                    try {
                        quickSaveFrame.contentWindow?.postMessage({ type: "refreshCurrentTab" }, "*");
                    } catch (e) {}
                }
            }
        }
    }

    if (tabDashboard && tabQuickSave) {
        tabDashboard.addEventListener("click", () => switchTab("dashboard"));
        tabQuickSave.addEventListener("click", () => switchTab("quick-save"));

        // Restore last active tab
        const savedTab = localStorage.getItem("activeTab") || "dashboard";
        switchTab(savedTab);
    }

    // Listen for resize messages from quick-save iframe
    window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "resizeIframe") {
            if (quickSaveFrame && event.data.height) {
                quickSaveFrame.style.minHeight = event.data.height + "px";
            }
        }
    });
});
