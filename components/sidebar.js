document.addEventListener("DOMContentLoaded", () => {
  const sidebarModern = document.getElementById("sidebar")
  const sidebarClassic = document.getElementById("sidebar-classic")
  const container = document.querySelector(".container")
  const collapseBtn = document.getElementById("sidebar-collapse-btn")
  const toggleSidebarButton = document.getElementById("toggle-sidebar")
  const sidebarStyleSwitcher = document.getElementById("sidebar-style-switcher")

  // Initialize sidebar style from localStorage
  initSidebarStyle()

  // Sidebar style switcher
  if (sidebarStyleSwitcher) {
    sidebarStyleSwitcher.addEventListener("change", (e) => {
      const style = e.target.value
      setSidebarStyle(style)
      localStorage.setItem("sidebarStyle", style)
    })
  }

  // Sidebar collapse/expand (modern sidebar)
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      const sidebar = document.getElementById("sidebar")
      sidebar.classList.toggle("collapsed")
      container.classList.toggle("collapsed")
      localStorage.setItem(
        "sidebarCollapsed",
        sidebar.classList.contains("collapsed"),
      )
    })
  }

  // Toggle sidebar (mobile/header button)
  if (toggleSidebarButton) {
    toggleSidebarButton.addEventListener("click", () => {
      const currentStyle = localStorage.getItem("sidebarStyle") || "modern"
      const sidebar =
        currentStyle === "classic"
          ? document.getElementById("sidebar-classic")
          : document.getElementById("sidebar")

      if (window.innerWidth <= 768) {
        sidebar.classList.toggle("mobile-open")
      } else {
        sidebar.classList.toggle("collapsed")
        container.classList.toggle("collapsed")
        localStorage.setItem(
          "sidebarCollapsed",
          sidebar.classList.contains("collapsed"),
        )
      }
    })
  }

  // Restore sidebar collapsed state
  const savedState = localStorage.getItem("sidebarCollapsed")
  if (savedState === "true" && sidebarModern) {
    sidebarModern.classList.add("collapsed")
    container.classList.add("collapsed")
  }

  // Section toggle (collapse/expand sections) - Modern sidebar
  const sectionHeaders = document.querySelectorAll(".sidebar-section-header")
  sectionHeaders.forEach((header) => {
    header.addEventListener("click", (e) => {
      if (e.target.closest(".sidebar-action-btn")) return

      const toggleTarget = header.getAttribute("data-toggle")
      const content = document.getElementById(`${toggleTarget}-content`)
      if (content) {
        content.classList.toggle("collapsed")
        header.setAttribute(
          "data-collapsed",
          content.classList.contains("collapsed"),
        )
        const sectionStates = JSON.parse(
          localStorage.getItem("sidebarSections") || "{}",
        )
        sectionStates[toggleTarget] = content.classList.contains("collapsed")
        localStorage.setItem("sidebarSections", JSON.stringify(sectionStates))
      }
    })
  })

  // Restore section states
  const sectionStates = JSON.parse(
    localStorage.getItem("sidebarSections") || "{}",
  )
  Object.keys(sectionStates).forEach((key) => {
    const content = document.getElementById(`${key}-content`)
    const header = document.querySelector(`[data-toggle="${key}"]`)
    if (content) {
      if (sectionStates[key]) {
        content.classList.add("collapsed")
        if (header) header.setAttribute("data-collapsed", "true")
      } else {
        content.classList.remove("collapsed")
        if (header) header.setAttribute("data-collapsed", "false")
      }
    }
  })

  // Smart filter menu items (Modern sidebar)
  const menuItems = document.querySelectorAll(".sidebar-menu-item")
  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((i) => i.classList.remove("active"))
      item.classList.add("active")
      const filter = item.getAttribute("data-filter")
      handleSmartFilter(filter)
    })
  })

  // Sort list items (Raindrop style)
  const sortItems = document.querySelectorAll(".sidebar-sort-item")
  sortItems.forEach((item) => {
    item.addEventListener("click", () => {
      sortItems.forEach((i) => i.classList.remove("active"))
      item.classList.add("active")
      const sortValue = item.getAttribute("data-sort")

      if (sortValue === "favorites") {
        const folderFilter = document.getElementById("folder-filter")
        if (folderFilter) folderFilter.value = ""
      }

      // Update hidden select and trigger change
      const sortFilter = document.getElementById("sort-filter")
      if (sortFilter) {
        sortFilter.value = sortValue
        sortFilter.dispatchEvent(new Event("change", { bubbles: true }))
      }
    })
  })

  // Search clear button (Modern)
  const searchInput = document.getElementById("search")
  const clearSearch = document.getElementById("clear-search")
  if (searchInput && clearSearch) {
    searchInput.addEventListener("input", () => {
      clearSearch.classList.toggle("hidden", !searchInput.value)
    })
    clearSearch.addEventListener("click", () => {
      searchInput.value = ""
      clearSearch.classList.add("hidden")
      searchInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }

  // Search clear button (Classic)
  const searchInputClassic = document.getElementById("search-classic")
  const clearSearchClassic = document.getElementById("clear-search-classic")
  if (searchInputClassic && clearSearchClassic) {
    clearSearchClassic.addEventListener("click", () => {
      searchInputClassic.value = ""
      searchInputClassic.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }

  // Toggle checkboxes - show select all when active (Modern)
  const toggleCheckboxes = document.getElementById("toggle-checkboxes")
  const selectAllContainer = document.getElementById("select-all-container")
  if (toggleCheckboxes && selectAllContainer) {
    toggleCheckboxes.addEventListener("click", () => {
      selectAllContainer.classList.toggle("hidden")
    })
  }

  // Sync inputs between modern and classic sidebars
  syncSidebarInputs()
})

// Initialize sidebar style
function initSidebarStyle() {
  const savedStyle = localStorage.getItem("sidebarStyle") || "modern"
  setSidebarStyle(savedStyle)

  // Set dropdown value
  const switcher = document.getElementById("sidebar-style-switcher")
  if (switcher) switcher.value = savedStyle
}

// Set sidebar style
function setSidebarStyle(style) {
  document.body.classList.remove(
    "sidebar-style-modern",
    "sidebar-style-classic",
  )
  document.body.classList.add(`sidebar-style-${style}`)

  const sidebarModern = document.getElementById("sidebar")
  const sidebarClassic = document.getElementById("sidebar-classic")

  if (style === "classic") {
    if (sidebarModern) sidebarModern.classList.add("hidden")
    if (sidebarClassic) sidebarClassic.classList.remove("hidden")
  } else {
    if (sidebarModern) sidebarModern.classList.remove("hidden")
    if (sidebarClassic) sidebarClassic.classList.add("hidden")
  }
}

// Sync inputs between sidebars
function syncSidebarInputs() {
  // Sync search inputs
  const searchModern = document.getElementById("search")
  const searchClassic = document.getElementById("search-classic")

  if (searchModern && searchClassic) {
    searchModern.addEventListener("input", () => {
      searchClassic.value = searchModern.value
    })
    searchClassic.addEventListener("input", () => {
      searchModern.value = searchClassic.value
      // Trigger the modern input event for filtering
      searchModern.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }

  // Sync folder filter
  const folderModern = document.getElementById("folder-filter")
  const folderClassic = document.getElementById("folder-filter-classic")

  if (folderModern && folderClassic) {
    folderModern.addEventListener("change", () => {
      folderClassic.value = folderModern.value
    })
    folderClassic.addEventListener("change", () => {
      folderModern.value = folderClassic.value
      folderModern.dispatchEvent(new Event("change", { bubbles: true }))
    })
  }

  // Sync sort filter
  const sortModern = document.getElementById("sort-filter")
  const sortClassic = document.getElementById("sort-filter-classic")

  if (sortModern && sortClassic) {
    sortModern.addEventListener("change", () => {
      sortClassic.value = sortModern.value
    })
    sortClassic.addEventListener("change", () => {
      sortModern.value = sortClassic.value
      sortModern.dispatchEvent(new Event("change", { bubbles: true }))
    })
  }
}

// Handle smart filter selection
function handleSmartFilter(filter) {
  const sortFilter = document.getElementById("sort-filter")
  const folderFilter = document.getElementById("folder-filter")

  switch (filter) {
    case "all":
      if (folderFilter) folderFilter.value = ""
      if (sortFilter) sortFilter.value = "default"
      break
    case "recent":
      if (folderFilter) folderFilter.value = ""
      if (sortFilter) sortFilter.value = "new"
      break
  }

  if (sortFilter)
    sortFilter.dispatchEvent(new Event("change", { bubbles: true }))
  if (folderFilter)
    folderFilter.dispatchEvent(new Event("change", { bubbles: true }))
}

// Update counts (called from main.js after bookmarks load)
export function updateSidebarCounts(bookmarks, favorites) {
  // Modern sidebar counts
  const totalCount = document.getElementById("bookmark-count")
  const favoritesCount = document.getElementById("favorites-count")

  const sidebarTotalCount = document.getElementById("sidebar-total-count")

  // Classic sidebar count
  const bookmarkCountClassic = document.getElementById("bookmark-count-classic")

  const favoritesTotal = bookmarks.filter((b) => b.isFavorite).length

  if (totalCount) totalCount.textContent = bookmarks.length
  if (favoritesCount) favoritesCount.textContent = favoritesTotal
  if (sidebarTotalCount)
    sidebarTotalCount.textContent = `${bookmarks.length} bookmarks`
  if (bookmarkCountClassic) bookmarkCountClassic.textContent = bookmarks.length
}
