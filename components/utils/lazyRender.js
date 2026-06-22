// components/utils/lazyRender.js

let currentLazyObserver = null;

export function appendBookmarksLazily(container, fragment, items, createElementFn, commonPostOps, elements) {
  if (currentLazyObserver) {
    currentLazyObserver.disconnect();
    currentLazyObserver = null;
  }
  
  // Append any headers/folders that are already in the fragment
  container.appendChild(fragment);
  
  const itemsToRender = items.filter(b => b && b.url);
  if (itemsToRender.length === 0) {
    if (commonPostOps) commonPostOps(elements);
    return;
  }
  
  let index = 0;
  const CHUNK_SIZE = 50;
  
  const sentinel = document.createElement("div");
  sentinel.className = "lazy-sentinel";
  sentinel.style.width = "100%";
  sentinel.style.height = "10px";
  sentinel.style.gridColumn = "1 / -1"; // For grid layouts
  
  function renderChunk() {
    const frag = document.createDocumentFragment();
    const end = Math.min(index + CHUNK_SIZE, itemsToRender.length);
    for (let i = index; i < end; i++) {
      const el = createElementFn(itemsToRender[i]);
      if (el) frag.appendChild(el);
    }
    
    if (sentinel.parentNode === container) {
      container.insertBefore(frag, sentinel);
    } else {
      container.appendChild(frag);
    }
    
    index = end;
    
    if (index >= itemsToRender.length) {
      if (currentLazyObserver) {
        currentLazyObserver.disconnect();
        currentLazyObserver = null;
      }
      if (sentinel.parentNode) sentinel.remove();
      if (commonPostOps) commonPostOps(elements);
    } else {
      if (sentinel.parentNode !== container) {
        container.appendChild(sentinel);
      }
      if (index === CHUNK_SIZE && commonPostOps) {
        commonPostOps(elements);
      }
    }
  }
  
  renderChunk();
  
  if (index < itemsToRender.length) {
    currentLazyObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderChunk();
      }
    }, { rootMargin: "800px" });
    currentLazyObserver.observe(sentinel);
  }
}
