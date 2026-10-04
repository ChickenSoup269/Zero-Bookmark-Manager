// components/qrPopup.js
// Shared big-QR popup used by the "Bookmarks + QR" view (bookmarkQR.js) and
// the per-bookmark "Generate QR" menu option (ui.js). Dependency-light:
// only utils.js (translations).
import { translations } from "./utils/utils.js"

let lang = localStorage.getItem("appLanguage") || "en"
const STYLE_KEY = "bqrQrStyle"

// logo visibility / position / size, remembered across pages
function loadStyle() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STYLE_KEY) || "{}")
    return { show: parsed.show !== false }
  } catch (e) {
    return { show: true }
  }
}

function saveStyle(style) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(style))
  } catch (e) {
    /* storage full/blocked — non-critical */
  }
}

function t(key) {
  const table = translations[lang] || translations.en
  return table[key] || key
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const LOGO_FRACTION = 0.13

function renderQr(container, url) {
  container.textContent = ""
  new window.QRCode(container, {
    text: url,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.H,
  })
}

// Composite PNG (QR + logo chip) for download; falls back to the plain QR
// when the favicon cannot be drawn without tainting the canvas.
function compositeDataUrl(qrContainer, style) {
  const canvas = qrContainer.querySelector("canvas")
  if (!canvas) return null
  const out = document.createElement("canvas")
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 0, out.width, out.height)

  if (style.show && qrContainer.__exportLogo && qrContainer.__exportLogo.ok) {
    const img = qrContainer.__exportLogo.img
    const size = out.width
    const lw = Math.round(size * LOGO_FRACTION)
    const pad = Math.max(4, Math.round(lw * 0.12))
    const chip = lw + pad * 2
    const x = Math.round((size - chip) / 2)
    const y = x
    ctx.fillStyle = "#ffffff"
    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(x, y, chip, chip, Math.round(chip * 0.18))
      ctx.fill()
    } else {
      ctx.fillRect(x, y, chip, chip)
    }
    ctx.drawImage(img, x + pad, y + pad, lw, lw)
  }

  try {
    return out.toDataURL("image/png")
  } catch (e) {
    // tainted canvas (favicon without CORS) — export the plain QR
    const plain = qrContainer.querySelector("canvas")
    try {
      return plain ? plain.toDataURL("image/png") : null
    } catch (e2) {
      return null
    }
  }
}

function extractPlainDataUrl(container) {
  const canvas = container.querySelector("canvas")
  if (canvas) {
    try {
      return canvas.toDataURL("image/png")
    } catch (e) {
      /* ignore */
    }
  }
  const img = container.querySelector("img")
  return img ? img.src : null
}

export function showQrPopup({ url, title, faviconUrl }) {
  document.querySelector(".bqr-popup-overlay")?.remove()

  const style = loadStyle()
  const overlay = document.createElement("div")
  overlay.className = "bqr-popup-overlay"
  const safeTitle = escapeHtml(title || url)
  const safeUrl = escapeHtml(url)
  overlay.innerHTML = `
    <div class="bqr-popup" role="dialog" aria-modal="true">
      <button type="button" class="bqr-popup-close" aria-label="Close">✕</button>
      <h3 class="bqr-popup-title">${safeTitle}</h3>
      <div class="bqr-popup-qr${style.show ? "" : " logo-hidden"}"></div>
      <p class="bqr-popup-url">${safeUrl}</p>
      <div class="bqr-custom">
        <div class="bqr-custom-row">
          <span class="bqr-custom-label">${escapeHtml(t("qrLogoLabel"))}</span>
          <div class="bqr-opt-group" data-opt="show">
            <button type="button" class="bqr-opt-btn${style.show ? "" : " active"}" data-value="hide">${escapeHtml(t("qrHideLogo"))}</button>
            <button type="button" class="bqr-opt-btn${style.show ? " active" : ""}" data-value="show">${escapeHtml(t("qrShowLogo"))}</button>
          </div>
        </div>
      </div>
      <div class="bqr-popup-actions">
        <button type="button" class="bqr-action-btn primary" data-action="download">
          <i class="fas fa-download"></i> <span>${escapeHtml(t("qrDownload"))}</span>
        </button>
        <button type="button" class="bqr-action-btn" data-action="copy">
          <i class="fas fa-link"></i> <span>${escapeHtml(t("qrCopyLink"))}</span>
        </button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const qrContainer = overlay.querySelector(".bqr-popup-qr")
  try {
    renderQr(qrContainer, url)
  } catch (e) {
    qrContainer.textContent = "Could not generate QR code."
  }

  // Display logo: clean white rounded chip. A separate CORS-clean copy is
  // loaded for PNG export (drawing the display img would taint the canvas).
  if (faviconUrl) {
    const favicon = document.createElement("img")
    favicon.className = "bqr-popup-favicon"
    favicon.src = faviconUrl
    favicon.onerror = () => favicon.remove()
    qrContainer.appendChild(favicon)

    const exportLogo = new Image()
    exportLogo.crossOrigin = "anonymous"
    qrContainer.__exportLogo = { img: exportLogo, ok: false }
    exportLogo.onload = () => {
      qrContainer.__exportLogo.ok = true
    }
    exportLogo.onerror = () => {
      qrContainer.__exportLogo.ok = false
    }
    exportLogo.src = faviconUrl
  }

  const applyStyle = () => {
    qrContainer.classList.toggle("logo-hidden", !style.show)
    saveStyle(style)
  }

  overlay.querySelectorAll(".bqr-opt-group").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".bqr-opt-btn")
      if (!btn) return
      const opt = group.dataset.opt
      const value = btn.dataset.value
      if (opt === "show") style.show = value === "show"
      else style[opt] = value
      group.querySelectorAll(".bqr-opt-btn").forEach((b) => b.classList.toggle("active", b === btn))
      applyStyle()
    })
  })

  const close = () => {
    overlay.remove()
    document.removeEventListener("keydown", onKeydown)
    window.removeEventListener("languageChanged", onLanguageChanged)
  }
  const onKeydown = (e) => {
    if (e.key === "Escape") close()
  }
  const onLanguageChanged = () => {
    lang = localStorage.getItem("appLanguage") || "en"
    showQrPopup({ url, title, faviconUrl })
  }
  document.addEventListener("keydown", onKeydown)
  window.addEventListener("languageChanged", onLanguageChanged)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close()
  })
  overlay.querySelector(".bqr-popup-close").addEventListener("click", close)

  overlay.querySelector('[data-action="download"]').addEventListener("click", () => {
    const dataUrl = compositeDataUrl(qrContainer, style) || extractPlainDataUrl(qrContainer)
    if (!dataUrl) return
    let host = "bookmark"
    try {
      host = new URL(url).hostname.replace(/^www\./, "")
    } catch (e) {
      /* keep fallback name */
    }
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `qr-${host}.png`
    a.click()
  })
  overlay.querySelector('[data-action="copy"]').addEventListener("click", () => {
    navigator.clipboard?.writeText(url).then(
      () => showCopiedToast(t("qrCopied")),
      () => {},
    )
  })
}

// Minimal toast so this module stays independent from utils' showCustomPopup
function showCopiedToast(message) {
  document.querySelector(".bqr-toast")?.remove()
  const toast = document.createElement("div")
  toast.className = "bqr-toast"
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.classList.add("visible"), 10)
  setTimeout(() => {
    toast.classList.remove("visible")
    setTimeout(() => toast.remove(), 250)
  }, 1600)
}
