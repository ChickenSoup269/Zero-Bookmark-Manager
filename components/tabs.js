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
            
            // Force iframe to recalculate height when it becomes visible
            const frame = document.getElementById("quick-save-frame");
            if (frame && frame.contentWindow && frame.contentWindow.document) {
                try {
                    frame.style.height = "auto";
                    setTimeout(() => {
                        if (frame.contentWindow.document.body) {
                            frame.style.height = frame.contentWindow.document.body.scrollHeight + "px";
                        }
                    }, 50);
                } catch (e) {}
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
