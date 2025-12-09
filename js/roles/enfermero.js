/**
 * Lógica específica para Enfermero
 * - Dashboard de camas
 * - Alertas en tiempo real
 * - Gestión de notificaciones
 */

 

 

// Usar Session, API, NotificationManager y RealtimeConnection globales

class Enfermero {
  constructor() {
    this.userId = getQueryParam("user_id")
    this.mockCamas = []
    this.mockAlertas = []
    this.pollingInterval = null
    this.notificationsEnabled = true
    this.assignedBeds = []
    this.init()
  }

  init() {
    this.checkAuth()
    if (!Session.isLoggedIn()) {
      this.showScannerUI()
      return
    }
    this.registerFcmToken()
    this.setupNotifications()
    this.loadData()
    this.setupEventListeners()
    this.startRealtimeMonitoring()
  }

  checkAuth() {
    const dash = document.querySelector(".enfermero-dashboard")
    const loginBox = document.getElementById("enfermero-login")
    if (this.userId) {
      const user = { role: "enfermero", id: this.userId, nombre: "Enfermero" }
      Session.setUser(user)
      Session.setToken("demo-token-" + generateUUID())
      dash.classList.remove("hidden")
      loginBox.classList.add("hidden")
      return
    }
    if (!Session.isLoggedIn()) {
      dash.classList.add("hidden")
      loginBox.classList.remove("hidden")
    }
  }

  showScannerUI() {
    const openBtn = document.getElementById("btn-scan-qr")
    const modal = document.getElementById("scanner-modal")
    const closeBtn = document.getElementById("btn-close-scanner")
    openBtn?.addEventListener("click", () => {
      modal.classList.remove("hidden")
      this.startQrScanner()
    })
    closeBtn?.addEventListener("click", () => {
      modal.classList.add("hidden")
      this.stopQrScanner()
    })
  }

  startQrScanner() {
    const video = document.getElementById("qr-video")
    const canvas = document.getElementById("qr-canvas")
    const ctx = canvas.getContext("2d")
    const constraints = { video: { facingMode: "environment" } }
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        this.qrStream = stream
        video.srcObject = stream
        this.qrInterval = setInterval(() => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            try {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const code = window.jsQR ? window.jsQR(imageData.data, canvas.width, canvas.height) : null
              if (code && code.data) {
                this.onQrDetected(code.data)
              }
            } catch {}
          }
        }, 250)
      })
      .catch(() => {
        showToast("No se pudo acceder a la cámara", "error")
      })
  }

  stopQrScanner() {
    if (this.qrInterval) {
      clearInterval(this.qrInterval)
      this.qrInterval = null
    }
    if (this.qrStream) {
      this.qrStream.getTracks().forEach((t) => t.stop())
      this.qrStream = null
    }
  }

  onQrDetected(text) {
    // Buscar user_id en el texto (URL o contenido)
    let uid = null
    try {
      const m = text.match(/user_id=([^&]+)/)
      uid = m && m[1]
      if (!uid && /^E\w+/.test(text)) uid = text
    } catch {}
    if (!uid) return

    this.stopQrScanner()
    document.getElementById("scanner-modal").classList.add("hidden")

    this.userId = uid
    const user = { role: "enfermero", id: uid, nombre: "Enfermero" }
    Session.setUser(user)
    Session.setToken("demo-token-" + generateUUID())

    document.getElementById("enfermero-login")?.classList.add("hidden")
    document.querySelector(".enfermero-dashboard")?.classList.remove("hidden")

    this.registerFcmToken()
    this.setupNotifications()
    this.loadData()
    this.setupEventListeners()
    this.startRealtimeMonitoring()
  }

  setupNotifications() {
    this.notificationsEnabled = localStorage.getItem("notifications_enabled") !== "false"
    const btn = document.getElementById("btn-toggle-notifications")
    if (btn) {
      btn.textContent = this.notificationsEnabled ? "🔔" : "🔕"
      btn.addEventListener("click", () => this.toggleNotifications())
    }
  }

  toggleNotifications() {
    this.notificationsEnabled = !this.notificationsEnabled
    localStorage.setItem("notifications_enabled", this.notificationsEnabled ? "true" : "false")

    const btn = document.getElementById("btn-toggle-notifications")
    btn.textContent = this.notificationsEnabled ? "🔔" : "🔕"

    showToast(this.notificationsEnabled ? "Notificaciones activadas" : "Notificaciones desactivadas", "info")
  }

  async loadData() {
    let nurse = null
    if (window.db && window.firestore) {
      const { doc, getDoc } = window.firestore
      try {
        const u = Session.getUser && Session.getUser()
        const id = (u && u.id) || this.userId
        if (id) {
          const d = await getDoc(doc(window.db, "enfermeros", id))
          if (d.exists()) nurse = { id: d.id, ...d.data() }
        }
      } catch {}
    }

    if (!nurse) {
      const u = Session.getUser && Session.getUser()
      const id = (u && u.id) || this.userId
      if (id) {
        const enfRes = await API.get("/enfermeros")
        if (enfRes.success) nurse = (enfRes.data || []).find((e) => e.id === id)
      }
    }

    this.assignedBeds = nurse && Array.isArray(nurse.camas) ? nurse.camas : []
    const islaId = nurse && nurse.isla_id

    const camasRes = await API.get("/camas", islaId ? { isla_id: islaId } : {})
    if (camasRes.success) this.mockCamas = camasRes.data || []

    if (!this.assignedBeds || this.assignedBeds.length === 0) {
      const infer = this.mockCamas.filter((c) => c.enfermero === (nurse && nurse.id)).map((c) => c.id)
      this.assignedBeds = infer
    }

    const myCamas = this.mockCamas.filter((c) => this.assignedBeds.includes(c.id))
    document.getElementById("cama-count").textContent = myCamas.length

    const header = document.querySelector(".header-title")
    if (header && nurse && nurse.nombre) header.textContent = `Dashboard Enfermero — ${nurse.nombre}`

    this.renderCamas()
  }

  registerFcmToken() {
    const user = Session.getUser && Session.getUser()
    const token = localStorage.getItem("fcm_token")
    if (user && user.id && token) {
      const raw = localStorage.getItem("nurse_fcm_tokens")
      const map = raw ? JSON.parse(raw) : {}
      map[user.id] = token
      localStorage.setItem("nurse_fcm_tokens", JSON.stringify(map))
    }
  }

  setupEventListeners() {
    // Modal de alertas
    document.getElementById("btn-close-alert")?.addEventListener("click", () => {
      document.getElementById("alert-modal").classList.add("hidden")
    })

    document.getElementById("btn-confirm-alert")?.addEventListener("click", () => {
      this.handleAlert(true)
    })

    document.getElementById("btn-dismiss-alert")?.addEventListener("click", () => {
      this.handleAlert(false)
    })
  }

  // ============================================
  // REALTIME MONITORING
  // ============================================

  startRealtimeMonitoring() {
    if (window.db && window.firestore) {
      const { collection, onSnapshot, query, where } = window.firestore
      const base = collection(window.db, "alertas")
      let q
      if (this.assignedBeds && this.assignedBeds.length > 0 && this.assignedBeds.length <= 10) {
        q = query(base, where("cama_id", "in", this.assignedBeds), where("confirmado", "==", false))
      } else {
        q = query(base, where("confirmado", "==", false))
      }
      this.unsubscribeAlerts = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const a = { id: change.doc.id, ...change.doc.data() }
          if (!a.confirmado && (!this.assignedBeds.length || this.assignedBeds.includes(a.cama_id))) {
            if (change.type === "added") {
              this.handleNewAlert(a)
            } else if (change.type === "modified") {
              const idx = this.mockAlertas.findIndex((x) => x.id === a.id)
              if (idx >= 0) this.mockAlertas[idx] = { ...this.mockAlertas[idx], ...a }
              this.renderAlertas()
            }
          }
        })
      })
      return
    }

    // Sin fallback de demo: operar únicamente con Firestore
  }

  simulateDemoAlert() {
    setTimeout(() => {
      if (Math.random() > 0.5) {
        const cama = this.mockCamas[Math.floor(Math.random() * this.mockCamas.length)]
        this.handleNewAlert({
          id: generateUUID(),
          cama_id: cama.id,
          paciente: cama.paciente,
          tipo: "ayuda",
          timestamp: new Date(),
        })
      }
      this.simulateDemoAlert()
    }, 15000)
  }

  handleNewAlert(alert) {
    this.mockAlertas.push(alert)

    // Actualizar contador
    const count = this.mockAlertas.filter((a) => !a.confirmado).length
    document.getElementById("alert-count").textContent = count

    // Mostrar notificación si está habilitada
    if (this.notificationsEnabled) {
      const body = `Cama ${alert.cama_id}${alert.paciente ? ` - ${alert.paciente}` : ''}`
      NotificationManager.show("Nueva Alerta", {
        body,
        tag: "alert-" + alert.id,
        requireInteraction: true,
      })
    }

    // Mostrar modal si es la primera alerta sin confirmar
    this.showAlertModal(alert)
    this.renderAlertas()
  }

  showAlertModal(alert) {
    const modal = document.getElementById("alert-modal")
    const content = document.getElementById("alert-content")

    content.innerHTML = `
      <div class="alert-item">
        <h3>Cama ${alert.cama_id}</h3>
        <p><strong>Paciente:</strong> ${alert.paciente || "—"}</p>
        <p><strong>Tipo:</strong> ${alert.tipo === "ayuda" ? "Solicitud de Ayuda" : alert.tipo}</p>
        <p><strong>Hora:</strong> ${formatDate(alert.timestamp)}</p>
      </div>
    `

    modal.dataset.alertId = alert.id
    modal.classList.remove("hidden")
  }

  handleAlert(confirmed) {
    const modal = document.getElementById("alert-modal")
    const alertId = modal.dataset.alertId

    const alert = this.mockAlertas.find((a) => a.id === alertId)
    if (alert) {
      alert.confirmado = confirmed

      // Enviar a API
      API.post("/alertas/" + alertId + "/confirm", { confirmado: confirmed })

      const raw = localStorage.getItem("alertas")
      const arr = raw ? JSON.parse(raw) : []
      const updated = arr.map((a) => (a.id === alertId ? { ...a, confirmado: confirmed } : a))
      localStorage.setItem("alertas", JSON.stringify(updated))

      showToast(confirmed ? "Alerta confirmada" : "Alerta descartada", confirmed ? "success" : "info")
    }

    modal.classList.add("hidden")
    this.renderAlertas()
  }

  // ============================================
  // RENDER
  // ============================================

  renderCamas() {
    const container = document.getElementById("lista-camas-enfermero")
    if (!container) return

    const list = this.mockCamas.filter((c) => this.assignedBeds.includes(c.id))
    container.innerHTML = list
      .map((cama) => {
        const estadoClass = cama.estado === "ocupada" ? "alert" : "empty-state"
        return `
        <div class="card-item">
          <h3>Cama ${cama.id}</h3>
          <p><strong>Estado:</strong> <span class="${estadoClass}">${cama.estado}</span></p>
          ${cama.paciente ? `<p><strong>Paciente:</strong> ${cama.paciente}</p>` : ""}
          <button class="btn btn-secondary btn-small" onclick="enfermero.viewCamaDetails('${cama.id}')">
            Ver detalles
          </button>
        </div>
      `
      })
      .join("")
  }

  renderAlertas() {
    const container = document.getElementById("alertas-container")
    if (!container) return

    const alertasPendientes = this.mockAlertas.filter((a) => !a.confirmado)

    if (alertasPendientes.length === 0) {
      container.innerHTML = '<p class="empty-state">Sin alertas en este momento</p>'
      return
    }

    container.innerHTML = alertasPendientes
      .map(
        (alerta) => `
      <div class="alert-item">
        <h3>Cama ${alerta.cama_id}</h3>
        <p><strong>Paciente:</strong> ${alerta.paciente || "—"}</p>
        <p><strong>Tipo:</strong> ${alerta.tipo === "ayuda" ? "Solicitud de Ayuda" : alerta.tipo}</p>
        <p><strong>Hora:</strong> ${formatDate(alerta.timestamp)}</p>
        <div class="alert-item-actions">
          <button class="btn btn-primary btn-small" onclick="enfermero.confirmAlert('${alerta.id}')">
            Confirmar
          </button>
          <button class="btn btn-secondary btn-small" onclick="enfermero.dismissAlert('${alerta.id}')">
            Descartar
          </button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  viewCamaDetails(camaId) {
    const cama = this.mockCamas.find((c) => c.id === camaId)
    if (cama) {
      showToast(`Cama ${camaId}: ${cama.paciente || "Libre"}`, "info")
    }
  }

  confirmAlert(alertId) {
    const alert = this.mockAlertas.find((a) => a.id === alertId)
    if (alert) {
      alert.confirmado = true
      API.post("/alertas/" + alertId + "/confirm", { confirmado: true })
      showToast("Alerta confirmada", "success")
      this.renderAlertas()
    }
  }

  dismissAlert(alertId) {
    const alert = this.mockAlertas.find((a) => a.id === alertId)
    if (alert) {
      alert.confirmado = true
      API.post("/alertas/" + alertId + "/dismiss", {})
      this.renderAlertas()
    }
  }
}

// Inicializar
let enfermero
document.addEventListener("DOMContentLoaded", () => {
  enfermero = new Enfermero()
})
