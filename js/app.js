/**
 * Lógica central de la PWA
 * - Registro de Service Worker
 * - Manejo de sesiones
 * - Utilidades compartidas
 */

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((registration) => {
        console.log("[v0] Service Worker registrado:", registration)
      })
      .catch((error) => {
        console.log("[v0] Error al registrar Service Worker:", error)
      })
  })
}

// ============================================
// SESSION MANAGEMENT
// ============================================

const Session = {
  setUser(user) {
    localStorage.setItem("user", JSON.stringify(user))
  },

  getUser() {
    const user = localStorage.getItem("user")
    return user ? JSON.parse(user) : null
  },

  setToken(token) {
    localStorage.setItem("auth_token", token)
  },

  getToken() {
    return localStorage.getItem("auth_token")
  },

  logout() {
    localStorage.removeItem("user")
    localStorage.removeItem("auth_token")
    localStorage.removeItem("notifications_enabled")
    window.location.href = "index.html"
  },

  isLoggedIn() {
    return !!this.getToken()
  },
}

// ============================================
// NOTIFICATIONS MANAGEMENT
// ============================================

const NotificationManager = {
  enabled: true,

  async init() {
    this.enabled = localStorage.getItem("notifications_enabled") !== "false"

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  },

  toggle() {
    this.enabled = !this.enabled
    localStorage.setItem("notifications_enabled", this.enabled ? "true" : "false")
    return this.enabled
  },

  async show(title, options = {}) {
    if (!this.enabled) return

    // Intentar con Service Worker
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        registration.showNotification(title, {
          badge:
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234a7c9e" width="192" height="192"/><text x="50%" y="50%" font-size="96" fill="white" text-anchor="middle" dy=".3em">H</text></svg>',
          ...options,
        })
      } catch (e) {
        console.log("[v0] No se pudo mostrar notificación con SW")
      }
    }

    // Fallback a Notification API
    if (Notification.permission === "granted") {
      new Notification(title, options)
    }
  },
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = "info", duration = 3000) {
  const toast = document.getElementById("toast")
  if (!toast) return

  toast.textContent = message
  toast.className = `toast ${type}`
  toast.classList.remove("hidden")

  setTimeout(() => {
    toast.classList.add("hidden")
  }, duration)
}

// ============================================
// UTILITIES
// ============================================

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getQueryParam(param) {
  const params = new URLSearchParams(window.location.search)
  return params.get(param)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  NotificationManager.init()
})

// Logout button handler (generic)
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("btn-logout")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      Session.logout()
    })
  }
})
