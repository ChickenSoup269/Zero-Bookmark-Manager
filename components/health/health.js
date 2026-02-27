import { uiState } from "../state.js" // Import state để cập nhật trạng thái
import { showCustomPopup } from "../utils/utils.js"

// Cấu hình
const CONCURRENT_LIMIT = 5 // Số lượng request kiểm tra cùng lúc
const TIMEOUT_MS = 5000 // 5 giây timeout

/**
 * Kiểm tra trạng thái của một URL
 */
async function checkUrlStatus(url) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // Dùng method HEAD để tiết kiệm băng thông, nếu fail thì thử GET
    let response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      mode: "no-cors",
    })

    // Lưu ý: mode 'no-cors' trả về opaque response (status = 0),
    // nhưng nếu fetch không throw error thì site có tồn tại.
    // Để check chính xác status code (404, 500), extension cần quyền host_permissions: ["<all_urls>"] trong manifest.json

    clearTimeout(id)
    return true // Site sống
  } catch (error) {
    clearTimeout(id)
    // Nếu fetch lỗi (network error, DNS resolution failed), coi như site chết
    return false
  }
}

// Phân tích mức độ "legit" của URL (chỉ heuristic, không tuyệt đối)
function analyzeUrlRisk(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const full = url.toLowerCase()

    let score = 0

    // HTTP không có HTTPS -> trừ điểm
    if (u.protocol === "http:") score += 2

    // Domain quá dài hoặc nhiều dấu gạch ngang
    if (host.length > 30) score += 1
    if (host.split("-").length > 3) score += 1

    // Punycode (thường dùng fake domain)
    if (host.includes("xn--")) score += 2

    // Một số TLD thường bị lạm dụng (chỉ heuristic)
    const suspiciousTlds = [
      ".ru",
      ".cn",
      ".tk",
      ".top",
      ".xyz",
      ".click",
      ".link",
    ]
    if (suspiciousTlds.some((tld) => host.endsWith(tld))) score += 2

    // Ký tự @ trong URL (thường dùng cho phishing)
    if (full.includes("@")) score += 2

    // Query chứa từ khóa login / verify / secure + nhiều tham số
    const q = u.search.toLowerCase()
    const riskyKeywords = ["login", "verify", "update", "secure", "account"]
    if (
      q &&
      riskyKeywords.some((k) => q.includes(k)) &&
      q.split("&").length > 3
    ) {
      score += 2
    }

    // Ngưỡng: score >= 4 coi là "mờ ám"
    return score >= 4 ? "alive_suspicious" : "alive_safe"
  } catch {
    // Nếu parse URL lỗi, coi như an toàn vừa phải
    return "alive_safe"
  }
}

/**
 * Hàm chính để kiểm tra danh sách bookmarks
 * @param {Array} bookmarks - Danh sách các bookmark object
 * @param {Function} onProgress - Callback sau mỗi lần check xong 1 URL (để update UI)
 * @param {Function} onComplete - Callback khi hoàn tất
 */
export async function checkBrokenLinks(bookmarks, onProgress, onComplete) {
  // 1. Lọc ra các bookmark có URL http/https
  const targets = bookmarks.filter((b) => b.url && b.url.startsWith("http"))

  if (targets.length === 0) {
    showCustomPopup("No bookmarks to check.", "info")
    return
  }

  // Khởi tạo state cho healthStatus nếu chưa có
  if (!uiState.healthStatus) uiState.healthStatus = {}

  let completed = 0
  let brokenCount = 0

  // Hàm worker để xử lý theo batch
  async function worker(bookmark) {
    // Đánh dấu đang check
    uiState.healthStatus[bookmark.id] = "checking"
    onProgress() // Re-render icon loading

    const isAlive = await checkUrlStatus(bookmark.url)

    if (isAlive) {
      // Lưu trạng thái chi tiết: safe / suspicious
      uiState.healthStatus[bookmark.id] = analyzeUrlRisk(bookmark.url)
    } else {
      uiState.healthStatus[bookmark.id] = "dead"
      brokenCount++
    }

    completed++
  }

  // Chạy queue với giới hạn concurrency
  // Chia mảng thành các chunks hoặc dùng Promise pool đơn giản
  const queue = [...targets]
  const runPool = async () => {
    const promises = []
    while (queue.length > 0) {
      if (promises.length >= CONCURRENT_LIMIT) {
        await Promise.race(promises)
      }
      const item = queue.shift()
      const p = worker(item).then(() => {
        // Remove self from promises array when done
        const idx = promises.indexOf(p)
        if (idx > -1) promises.splice(idx, 1)
        onProgress() // Re-render cập nhật kết quả từng cái
      })
      promises.push(p)
    }
    await Promise.all(promises)
  }

  await runPool()

  onComplete(brokenCount)
}
