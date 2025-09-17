document.addEventListener("DOMContentLoaded", () => {
  const toggleSidebarButton = document.getElementById("toggle-sidebar")
  const sidebar = document.querySelector(".sidebar")
  const container = document.querySelector(".container")

  toggleSidebarButton.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed")
    container.classList.toggle("collapsed")
  })
})
