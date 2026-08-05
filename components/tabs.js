document.addEventListener("DOMContentLoaded", () => {
    const tabDashboard = document.getElementById("tab-dashboard");
    const tabQuickSave = document.getElementById("tab-quick-save");
    const dashboardView = document.getElementById("dashboard-view");
    const quickSaveView = document.getElementById("quick-save-view");
    const quickSaveFrame = document.getElementById("quick-save-frame");

    let iframeLoaded = false;

    function getQuickSaveSrc() {
        return new Promise((resolve) => {
            const urlParams = new URLSearchParams(window.location.search);
            const tabId = urlParams.get('tabId');
            if (tabId) {
                resolve(`quick-save.html?embedded=true&tabId=${tabId}`);
            } else if (typeof chrome !== "undefined" && chrome.windows) {
                chrome.windows.getLastFocused({ windowTypes: ['normal'] }, function(win) {
                    if (win && win.id) {
                        chrome.tabs.query({ active: true, windowId: win.id }, (tabs) => {
                            if (tabs && tabs.length > 0) {
                                resolve(`quick-save.html?embedded=true&tabId=${tabs[0].id}`);
                            } else {
                                resolve(`quick-save.html?embedded=true`);
                            }
                        });
                    } else {
                        resolve(`quick-save.html?embedded=true`);
                    }
                });
            } else {
                resolve(`quick-save.html?embedded=true`);
            }
        });
    }

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

            // Lazy-load iframe src only on first activation
            if (quickSaveFrame && !iframeLoaded) {
                iframeLoaded = true;
                getQuickSaveSrc().then(src => {
                    quickSaveFrame.src = src;
                });
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
            if (quickSaveFrame) {
                quickSaveFrame.style.height = event.data.height + "px";
                quickSaveView.style.overflow = "visible";
            }
        }
    });
});
