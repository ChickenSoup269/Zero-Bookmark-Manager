document.addEventListener("DOMContentLoaded", () => {
    const tabDashboard = document.getElementById("tab-dashboard");
    const tabQuickSave = document.getElementById("tab-quick-save");
    const dashboardView = document.getElementById("dashboard-view");
    const quickSaveView = document.getElementById("quick-save-view");

    function switchTab(tab) {
        localStorage.setItem("activeTab", tab);
        
        if (tab === "dashboard") {
            tabDashboard.classList.add("active");
            tabQuickSave.classList.remove("active");
            
            dashboardView.style.display = "flex";
            quickSaveView.style.display = "none";
        } else if (tab === "quick-save") {
            tabQuickSave.classList.add("active");
            tabDashboard.classList.remove("active");
            
            quickSaveView.style.display = "flex";
            dashboardView.style.display = "none";
            
            // Explicitly size the iframe to fill available space
            const frame = document.getElementById("quick-save-frame");
            if (frame) {
                const tabsWrapper = document.querySelector(".app-tabs-wrapper");
                const header = document.querySelector(".header");
                const footer = document.querySelector(".footer");
                const usedHeight =
                    (tabsWrapper ? tabsWrapper.offsetHeight : 0) +
                    (header ? header.offsetHeight : 0) +
                    (footer ? footer.offsetHeight : 0);
                const available = window.innerHeight - usedHeight - 40; // 40px padding buffer
                frame.style.height = Math.max(available, 500) + "px";
            }
        }
    }

    if (tabDashboard && tabQuickSave) {
        tabDashboard.addEventListener("click", () => switchTab("dashboard"));
        tabQuickSave.addEventListener("click", () => switchTab("quick-save"));
        
        // Load the previously saved tab, default to dashboard
        const savedTab = localStorage.getItem("activeTab") || "dashboard";
        switchTab(savedTab);
    }

    // Initialize quick-save-frame with the active tab ID
    const quickSaveFrame = document.getElementById("quick-save-frame");
    if (quickSaveFrame && chrome && chrome.tabs) {
        const urlParams = new URLSearchParams(window.location.search);
        const tabId = urlParams.get('tabId');
        
        if (tabId) {
            quickSaveFrame.src = `quick-save.html?embedded=true&tabId=${tabId}`;
        } else {
            // fallback for when tabId is not provided in URL
            chrome.windows.getLastFocused({ windowTypes: ['normal'] }, function(win) {
                if (win && win.id) {
                    chrome.tabs.query({ active: true, windowId: win.id }, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            quickSaveFrame.src = `quick-save.html?embedded=true&tabId=${tabs[0].id}`;
                        } else {
                            quickSaveFrame.src = `quick-save.html?embedded=true`;
                        }
                    });
                } else {
                    quickSaveFrame.src = `quick-save.html?embedded=true`;
                }
            });
        }
    }
});
