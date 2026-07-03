// ./components/controller/dropdown.js
export function attachDropdownListeners() {
  const dropdownButtons = document.querySelectorAll(".dropdown-btn")
  
  // Clone to remove old listeners (if any) to prevent duplicates
  dropdownButtons.forEach((button) => {
    const newButton = button.cloneNode(true)
    button.parentNode.replaceChild(newButton, button)
  })

  // Re-query buttons after cloning
  const newDropdownButtons = document.querySelectorAll(".dropdown-btn")
  newDropdownButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation()
      
      // Find the menu. If it's already in the body, we can find it by some attribute, or it's just nextElementSibling if not moved yet.
      // But actually, it's easier to always keep it next to the button, and only move it to body when showing.
      // Let's check if there's a nextElementSibling that is a dropdown-menu
      let dropdownMenu = button.nextElementSibling;
      
      // If it was moved to body, we might need to find it by bookmark ID.
      const bookmarkId = button.getAttribute("data-id");
      if (!dropdownMenu || !dropdownMenu.classList.contains("dropdown-menu")) {
        // Try to find it in the body
        if (bookmarkId) {
          const bodyMenus = document.body.querySelectorAll(".bookmark-dropdown-menu");
          bodyMenus.forEach(m => {
            if (m.querySelector(`[data-id="${bookmarkId}"]`)) {
              dropdownMenu = m;
            }
          });
        }
      }

      if (dropdownMenu && dropdownMenu.classList.contains("dropdown-menu")) {
        const isHidden = dropdownMenu.classList.contains("hidden");
        
        // Hide all other menus
        document.querySelectorAll(".dropdown-menu").forEach((menu) => {
          menu.classList.add("hidden");
          // If menu is in body and hidden, maybe move it back? Not strictly necessary.
        });

        if (isHidden) {
          // Move to body to prevent clipping
          if (dropdownMenu.parentNode !== document.body) {
            document.body.appendChild(dropdownMenu);
          }
          
          dropdownMenu.classList.remove("hidden");
          dropdownMenu.style.position = "fixed";
          dropdownMenu.style.zIndex = "10000";
          dropdownMenu.style.right = "auto";
          
          const rect = button.getBoundingClientRect();
          let x = rect.left;
          let y = rect.bottom;
          
          const menuRect = dropdownMenu.getBoundingClientRect();
          if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 5;
          if (y + menuRect.height > window.innerHeight) {
            y = rect.top - menuRect.height;
            if (y < 0) y = 5;
          }
          
          dropdownMenu.style.left = `${x}px`;
          dropdownMenu.style.top = `${y}px`;
        } else {
          dropdownMenu.classList.add("hidden");
        }
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
