// ./components/controller/dropdown.js
export function attachDropdownListeners() {
  if (document.__bookmarkDropdownListenersAttached) return
  document.__bookmarkDropdownListenersAttached = true

  document.addEventListener("click", (e) => {
    const button = e.target.closest(".dropdown-btn")
    if (!button) {
      if (!e.target.closest(".dropdown-menu")) {
        document
          .querySelectorAll(".dropdown-menu")
          .forEach((menu) => menu.classList.add("hidden"))
      }
      return
    }

    e.stopPropagation()
    let dropdownMenu = button.nextElementSibling
    const bookmarkId = button.getAttribute("data-id")
    if (!dropdownMenu?.classList.contains("dropdown-menu") && bookmarkId) {
      dropdownMenu = Array.from(
        document.body.querySelectorAll(".bookmark-dropdown-menu"),
      ).find((menu) => menu.querySelector(`[data-id="${bookmarkId}"]`))
    }
    if (!dropdownMenu?.classList.contains("dropdown-menu")) return

    const isHidden = dropdownMenu.classList.contains("hidden")
    document
      .querySelectorAll(".dropdown-menu")
      .forEach((menu) => menu.classList.add("hidden"))
    if (!isHidden) return

    if (dropdownMenu.parentNode !== document.body) {
      document.body.appendChild(dropdownMenu)
    }
    dropdownMenu.classList.remove("hidden")
    dropdownMenu.style.position = "fixed"
    dropdownMenu.style.zIndex = "10000"
    dropdownMenu.style.right = "auto"

    const rect = button.getBoundingClientRect()
    const menuRect = dropdownMenu.getBoundingClientRect()
    let x = rect.right - menuRect.width
    let y = rect.bottom + 4
    if (x < 0) x = 5
    if (x + menuRect.width > window.innerWidth)
      x = window.innerWidth - menuRect.width - 5
    if (y + menuRect.height > window.innerHeight) {
      y = rect.top - menuRect.height - 4
      if (y < 0) y = 5
    }
    dropdownMenu.style.left = `${x}px`
    dropdownMenu.style.top = `${y}px`
  })

  window.addEventListener(
    "scroll",
    () => {
      document
        .querySelectorAll(".bookmark-dropdown-menu:not(.hidden)")
        .forEach((menu) => menu.classList.add("hidden"))
    },
    { capture: true, passive: true },
  )
}
