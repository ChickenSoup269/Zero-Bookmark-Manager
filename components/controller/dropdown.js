// ./components/controller/dropdown.js
export function attachDropdownListeners() {
  const dropdownButtons = document.querySelectorAll(".dropdown-btn")
  dropdownButtons.forEach((button) => {
    const newButton = button.cloneNode(true)
    button.parentNode.replaceChild(newButton, button)
  })

  // Re-query buttons after cloning
  const newDropdownButtons = document.querySelectorAll(".dropdown-btn")
  newDropdownButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation()
      const dropdownMenu = button.nextElementSibling
      if (dropdownMenu && dropdownMenu.classList.contains("dropdown-menu")) {
        dropdownMenu.classList.toggle("hidden")
        document.querySelectorAll(".dropdown-menu").forEach((menu) => {
          if (menu !== dropdownMenu) {
            menu.classList.add("hidden")
          }
        })
      }
    })
  })

  // Close all dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".dropdown-btn") &&
      !e.target.closest(".dropdown-menu")
    ) {
      document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        menu.classList.add("hidden")
      })
    }
  })
}
