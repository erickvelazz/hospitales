/**
 * Service Worker para PWA
 * - Cache App Shell
 * - Manejo offline
 * - Push notifications
 */

const CACHE_VERSION = 'v' + new Date().getTime()
const CACHE_NAME = `app-cache-${CACHE_VERSION}`
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/admin_isla.html",
  "/superadmin.html",
  "/enfermero.html",
  "/paciente.html",
  "/manifest.json",
  "/css/styles.css",
  "/js/app.js",
  "/js/utils/api.js",
  "/js/roles/adminIsla.js",
  "/js/roles/enfermero.js",
  "/js/roles/paciente.js",
  "/js/roles/superadmin.js",
]

// ============================================
// INSTALL
// ============================================

self.addEventListener("install", (event) => {
  console.log("[v0] Service Worker - Installing...")

  self.skipWaiting()
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[v0] Caching App Shell")
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.log("[v0] Cache addAll error (some assets may not be available yet):", err)
        // Continuar sin fallar
        return Promise.resolve()
      })
    }),
  )
})

// ============================================
// ACTIVATE
// ============================================

self.addEventListener("activate", (event) => {
  console.log("[v0] Service Worker - Activating...")

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[v0] Deleting old cache:", key)
            return caches.delete(key)
          })
      )
    )
  )
  
  self.clients.claim()
})

// ============================================
// FETCH
// ============================================

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Estrategia: Network first para API, cache first para estáticos
  if (url.pathname.startsWith("/api/")) {
    // Network first para API
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_NAME)
            cache.then((c) => c.put(event.request, response.clone()))
          }
          return response
        })
        .catch(() => {
          // Fallback a cache si falla la red
          return caches.match(event.request)
        }),
    )
  } else {
    // Cache first para estáticos
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== "basic") {
              return response
            }

            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })

            return response
          })
          .catch(() => {
            // Offline fallback
            return new Response("Offline - archivo no disponible", {
              status: 503,
              statusText: "Service Unavailable",
              headers: new Headers({
                "Content-Type": "text/plain",
              }),
            })
          })
      }),
    )
  }
})

// ============================================
// PUSH NOTIFICATIONS
// ============================================

/**
 * TODO: Configurar push notifications con servidor
 * Ejemplo de cómo recibir push events desde el servidor
 */
self.addEventListener("push", (event) => {
  console.log("[v0] Push notification received:", event)

  if (!event.data) {
    console.log("[v0] Push sin datos")
    return
  }

  try {
    const data = event.data.json()
    const notif = data.notification || {}
    const payloadData = data.data || {}
    const title = notif.title || data.title || "Nueva Alerta"
    const fallbackBody = payloadData && (payloadData.cama_id || payloadData.paciente)
      ? `Cama ${data.data.cama_id}${data.data.paciente ? ` - ${data.data.paciente}` : ''}`
      : "Nueva notificación"
    const options = {
      body: notif.body || data.body || fallbackBody,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234a7c9e" width="192" height="192"/><text x="50%" y="50%" font-size="96" fill="white" text-anchor="middle" dy=".3em">H</text></svg>',
      badge:
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234a7c9e" width="192" height="192"/><text x="50%" y="50%" font-size="96" fill="white" text-anchor="middle" dy=".3em">H</text></svg>',
      tag: data.tag || notif.tag || "notification",
      requireInteraction: data.requireInteraction || notif.requireInteraction || false,
      data: payloadData,
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (error) {
    console.error("[v0] Error procesando push:", error)
    event.waitUntil(
      self.registration.showNotification("Hospital Sistema", {
        body: event.data.text(),
      }),
    )
  }
})

// ============================================
// NOTIFICATION CLICK
// ============================================

self.addEventListener("notificationclick", (event) => {
  console.log("[v0] Notification clicked:", event.notification.tag)

  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Buscar si ya hay una ventana abierta
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus()
        }
      }
      // Si no hay, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow("/")
      }
    }),
  )
})

// ============================================
// MESSAGE EVENTS
// ============================================

/**
 * Recibir mensajes desde clients (páginas)
 * TODO: Implementar según necesidad
 */
self.addEventListener("message", (event) => {
  console.log("[v0] Service Worker - Message:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
