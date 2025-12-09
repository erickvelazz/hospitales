/**
 * API Client - Stubs para integración con backend
 * Proporciona métodos para GET, POST, PUT, DELETE
 * También incluye ejemplo de conexión WebSocket/polling
 */

const API = {
  baseURL: (typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "") + "/api",
  timeout: 10000,

  /**
   * GET request
   * TODO: conectar con API real
   */
  async get(endpoint, params = {}) {
    console.log(`[v0] API GET: ${endpoint}`, params)

    try {
      if (window.db) {
        const { collection, getDocs, query, where } = window.firestore || {}
        if (endpoint === "/islas") {
          const snap = await getDocs(collection(window.db, "islas"))
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          return { success: true, data: list }
        }
        if (endpoint === "/validate-token") {
          const basePac = collection(window.db, "pacientes")
          const snap = await getDocs(query(basePac, where("cama", "==", params.cama_id)))
          const docItem = snap.docs[0]
          if (docItem) {
            const paciente = { id: docItem.id, ...docItem.data() }
            return { success: true, data: { valid: true, paciente } }
          }
          // Si no existe en Firestore, continuar a fallback local
        }
        if (endpoint === "/alertas") {
          const base = collection(window.db, "alertas")
          const snap = await getDocs(base)
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          return { success: true, data: list }
        }
        if (endpoint === "/camas") {
          const base = collection(window.db, "camas")
          const snap = params.isla_id ? await getDocs(query(base, where("isla_id", "==", params.isla_id))) : await getDocs(base)
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          return { success: true, data: list }
        }
        if (endpoint === "/enfermeros") {
          const base = collection(window.db, "enfermeros")
          const snap = params.isla_id ? await getDocs(query(base, where("isla_id", "==", params.isla_id))) : await getDocs(base)
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          return { success: true, data: list }
        }
        if (endpoint === "/pacientes") {
          const base = collection(window.db, "pacientes")
          const snap = params.isla_id ? await getDocs(query(base, where("isla_id", "==", params.isla_id))) : await getDocs(base)
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          return { success: true, data: list }
        }
      }
    } catch (e) {}

    const mockData = this._getMockData(endpoint, params)
    if (mockData) {
      return { success: true, data: mockData }
    }

    try {
      const query = new URLSearchParams(params).toString()
      const url = `${this.baseURL}${endpoint}${query ? "?" + query : ""}`

      const response = await Promise.race([
        fetch(url, { headers: this._getHeaders() }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), this.timeout)),
      ])

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { success: true, data: await response.json() }
    } catch (error) {
      console.error("[v0] API Error (GET):", error)
      return { success: false, error: error.message }
    }
  },

  /**
   * POST request
   * TODO: conectar con API real
   */
  async post(endpoint, data = {}) {
    console.log(`[v0] API POST: ${endpoint}`, data)
    try {
      if (window.db) {
        const { collection, addDoc, doc, updateDoc, serverTimestamp } = window.firestore || {}
        if (endpoint === "/islas") {
          const ref = await addDoc(collection(window.db, "islas"), { ...data, created_at: serverTimestamp && serverTimestamp() })
          return { success: true, data: { id: ref.id, ...data } }
        }
        if (endpoint === "/alertas") {
          const ref = await addDoc(collection(window.db, "alertas"), {
            ...data,
            confirmado: false,
            created_at: serverTimestamp && serverTimestamp(),
          })
          return { success: true, data: { id: ref.id, ...data, confirmado: false } }
        }
        if (endpoint.startsWith("/alertas/") && endpoint.endsWith("/confirm")) {
          const id = endpoint.split("/")[2]
          await updateDoc(doc(window.db, "alertas", id), { confirmado: data.confirmado === true })
          return { success: true, data: { id } }
        }
        if (endpoint.startsWith("/alertas/") && endpoint.endsWith("/dismiss")) {
          const id = endpoint.split("/")[2]
          await updateDoc(doc(window.db, "alertas", id), { confirmado: true })
          return { success: true, data: { id } }
        }
        if (endpoint === "/camas") {
          const ref = await addDoc(collection(window.db, "camas"), { ...data, created_at: serverTimestamp && serverTimestamp() })
          return { success: true, data: { id: ref.id, ...data } }
        }
        if (endpoint === "/enfermeros") {
          const ref = await addDoc(collection(window.db, "enfermeros"), { ...data, created_at: serverTimestamp && serverTimestamp() })
          return { success: true, data: { id: ref.id, ...data } }
        }
        if (endpoint === "/pacientes") {
          const ref = await addDoc(collection(window.db, "pacientes"), { ...data, created_at: serverTimestamp && serverTimestamp() })
          return { success: true, data: { id: ref.id, ...data } }
        }
      }
    } catch (e) {}

    try {
      if (endpoint === "/notify") {
        const raw = localStorage.getItem("last_notify")
        const arr = raw ? JSON.parse(raw) : []
        arr.unshift({ ...data, at: Date.now() })
        localStorage.setItem("last_notify", JSON.stringify(arr))
        return { success: true, data: { ok: true } }
      }
      const response = await Promise.race([
        fetch(`${this.baseURL}${endpoint}`, {
          method: "POST",
          headers: this._getHeaders(),
          body: JSON.stringify(data),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), this.timeout)),
      ])

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { success: true, data: await response.json() }
    } catch (error) {
      console.error("[v0] API Error (POST):", error)
      return { success: false, error: error.message }
    }
  },

  /**
   * PUT request
   * TODO: conectar con API real
   */
  async put(endpoint, data = {}) {
    console.log(`[v0] API PUT: ${endpoint}`, data)
    try {
      if (window.db) {
        const { doc, updateDoc } = window.firestore || {}
        const parts = endpoint.split("/").filter(Boolean)
        if (parts.length === 2) {
          const col = parts[0]
          const id = parts[1]
          if (["islas", "camas", "enfermeros", "pacientes", "alertas"].includes(col)) {
            await updateDoc(doc(window.db, col, id), data)
            return { success: true, data: { id } }
          }
        }
      }
    } catch (e) {}

    // Fallback localStorage para colecciones conocidas
    try {
      const parts = endpoint.split("/").filter(Boolean)
      if (parts.length === 2) {
        const col = parts[0]
        const id = parts[1]
        if (["islas", "camas", "enfermeros", "pacientes", "alertas"].includes(col)) {
          const raw = localStorage.getItem(col)
          const arr = raw ? JSON.parse(raw) : []
          const updated = arr.map((item) => (item.id === id ? { ...item, ...data } : item))
          localStorage.setItem(col, JSON.stringify(updated))
          return { success: true, data: { id } }
        }
      }
    } catch (e) {}

    try {
      const response = await Promise.race([
        fetch(`${this.baseURL}${endpoint}`, {
          method: "PUT",
          headers: this._getHeaders(),
          body: JSON.stringify(data),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), this.timeout)),
      ])

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { success: true, data: await response.json() }
    } catch (error) {
      console.error("[v0] API Error (PUT):", error)
      return { success: false, error: error.message }
    }
  },

  /**
   * DELETE request
   * TODO: conectar con API real
   */
  async delete(endpoint) {
    console.log(`[v0] API DELETE: ${endpoint}`)
    try {
      if (window.db) {
        const { doc, deleteDoc } = window.firestore || {}
        const parts = endpoint.split("/").filter(Boolean)
        if (parts.length === 2) {
          const col = parts[0]
          const id = parts[1]
          if (["islas", "camas", "enfermeros", "pacientes", "alertas"].includes(col)) {
            await deleteDoc(doc(window.db, col, id))
            return { success: true, data: { id } }
          }
        }
      }
    } catch (e) {}

    // Fallback localStorage para colecciones conocidas
    try {
      const parts = endpoint.split("/").filter(Boolean)
      if (parts.length === 2) {
        const col = parts[0]
        const id = parts[1]
        if (["islas", "camas", "enfermeros", "pacientes", "alertas"].includes(col)) {
          const raw = localStorage.getItem(col)
          const arr = raw ? JSON.parse(raw) : []
          const updated = arr.filter((item) => item.id !== id)
          localStorage.setItem(col, JSON.stringify(updated))
          return { success: true, data: { id } }
        }
      }
    } catch (e) {}

    try {
      const response = await Promise.race([
        fetch(`${this.baseURL}${endpoint}`, {
          method: "DELETE",
          headers: this._getHeaders(),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), this.timeout)),
      ])

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { success: true, data: await response.json() }
    } catch (error) {
      console.error("[v0] API Error (DELETE):", error)
      return { success: false, error: error.message }
    }
  },

  _getHeaders() {
    const token = localStorage.getItem("auth_token")
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  },

  /**
   * Mock data para demo - eliminar cuando se conecte API real
   */
  _getMockData(endpoint, params) {
    if (endpoint === "/validate-token") {
      // Buscar paciente por cama en almacenamiento local
      const rawPac = localStorage.getItem("pacientes")
      if (rawPac) {
        try {
          const arr = JSON.parse(rawPac)
          const pac = arr.find((p) => String(p.cama) === String(params.cama_id))
          if (pac) return { valid: true, paciente: pac }
        } catch {}
      }
      // Sin demo: si no se encuentra, marcar inválido
      return { valid: false }
    }

    if (endpoint === "/camas") {
      const raw = localStorage.getItem("camas")
      if (raw) {
        const arr = JSON.parse(raw)
        return params.isla_id ? arr.filter((x) => x.isla_id === params.isla_id) : arr
      }
      return []
    }

    if (endpoint === "/enfermeros") {
      const raw = localStorage.getItem("enfermeros")
      if (raw) {
        const arr = JSON.parse(raw)
        return params.isla_id ? arr.filter((x) => x.isla_id === params.isla_id) : arr
      }
      return []
    }

    if (endpoint === "/pacientes") {
      const raw = localStorage.getItem("pacientes")
      if (raw) {
        const arr = JSON.parse(raw)
        return params.isla_id ? arr.filter((x) => x.isla_id === params.isla_id) : arr
      }
      return []
    }

    if (endpoint === "/islas") {
      const raw = localStorage.getItem("islas")
      return raw ? JSON.parse(raw) : []
    }

    if (endpoint === "/alertas") {
      const raw = localStorage.getItem("alertas")
      return raw ? JSON.parse(raw) : []
    }

    return null
  },
}

// ============================================
// REALTIME CONNECTION - WebSocket / Polling
// ============================================

const RealtimeConnection = {
  ws: null,
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  listeners: {},
  lastWsURL: null,

  /**
   * Conectar a WebSocket
   * TODO: reemplazar con URL real del servidor
   */
  connect(wsURL) {
    console.log("[v0] Intentando conectar WebSocket...")

    const url = wsURL || (typeof window !== "undefined" && window.WS_URL ? window.WS_URL : null)
    if (!url) {
      return
    }

    try {
      this.ws = new WebSocket(url)
      this.lastWsURL = url

      this.ws.onopen = () => {
        console.log("[v0] WebSocket conectado")
        this.isConnected = true
        this.reconnectAttempts = 0
        this.emit("connected")
      }

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
        console.log("[v0] WebSocket mensaje:", message)
        this.emit("message", message)
      }

      this.ws.onerror = (error) => {
        console.error("[v0] WebSocket error:", error)
        this.emit("error", error)
      }

      this.ws.onclose = () => {
        console.log("[v0] WebSocket desconectado")
        this.isConnected = false
        this.reconnect()
      }
    } catch (error) {
      console.error("[v0] Error al crear WebSocket:", error)
      this.reconnect()
    }
  },

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`[v0] Reintentando conexión (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => this.connect(this.lastWsURL), this.reconnectDelay)
    }
  },

  send(data) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(data))
    }
  },

  /**
   * Alternativa: Polling con setInterval
   * TODO: configurar URL real del servidor
   */
  startPolling(endpoint = "/alertas", interval = 3000) {
    console.log("[v0] Iniciando polling...")

    const poll = async () => {
      const result = await API.get(endpoint)
      if (result.success && result.data) {
        this.emit("message", { type: "alert", data: result.data })
      }
    }

    // Primer polling inmediato
    poll()

    // Polls periódicos
    return setInterval(poll, interval)
  },

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data))
    }
  },
}
