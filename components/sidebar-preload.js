(function preloadSidebarSections() {
  try {
    const sectionStates = JSON.parse(
      localStorage.getItem("sidebarSections") || "{}",
    )

    if (sectionStates.workspaces) {
      document.documentElement.classList.add(
        "sidebar-workspaces-precollapsed",
      )
    }
  } catch (error) {
    document.documentElement.classList.remove(
      "sidebar-workspaces-precollapsed",
    )
  }
})()
