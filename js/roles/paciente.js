/**
 * Lógica específica para Paciente
 * - Validación de token
 * - Información del paciente
 * - Botón "Solicitar Ayuda"
 */

 

// Usar API global (js/utils/api.js)

 

class Paciente {
  constructor() {
    this.camaId = getQueryParam("cama_id")
    this.token = getQueryParam("token")
    this.pacienteData = null
    this.helpTimeout = null
    this.helpInterval = null
    this.qrDetector = null
    this.qrStream = null
    this.qrInterval = null
    this.html5Qr = null
    this.init()
  }

  async init() {
    if (!this.camaId || !this.token) {
      await this.startQRAuth()
      return
    }
    await this.validateToken()
    this.setupEventListeners()
  }

  async validateToken() {
    // Validar token
    const result = await API.get("/validate-token", {
      cama_id: this.camaId,
      token: this.token,
    })

    const errorDiv = document.getElementById("validation-error")
    const contentDiv = document.getElementById("paciente-content")

    if (result.success && result.data.valid) {
      this.pacienteData = result.data.paciente
      try {
        Session.setUser({ role: "paciente", id: this.pacienteData.id, nombre: this.pacienteData.nombre, cama: this.pacienteData.cama })
        Session.setToken(this.token || ("paciente-token-" + generateUUID()))
      } catch (_) {}
      this.renderPacienteInfo()
      contentDiv.classList.remove("hidden")
    } else {
      errorDiv.classList.remove("hidden")
      contentDiv.classList.add("hidden")
      console.log("[v0] Token inválido")
      await this.startQRAuth()
    }
  }

  renderPacienteInfo() {
    document.getElementById("paciente-nombre").textContent = this.pacienteData.nombre
    document.getElementById("paciente-cama").textContent = this.pacienteData.cama
    document.getElementById("paciente-tratamiento").textContent = this.pacienteData.tratamiento
    document.getElementById("paciente-notas").textContent = this.pacienteData.notas
  }

  setupEventListeners() {
    const btn = document.getElementById("btn-solicitar-ayuda")
    if (btn) {
      btn.addEventListener("click", () => this.solicitarAyuda())
    }
  }

  async solicitarAyuda() {
    const btn = document.getElementById("btn-solicitar-ayuda")
    const feedback = document.getElementById("help-feedback")
    const countdownEl = document.getElementById("help-countdown")

    btn.disabled = true
    let remaining = 15
    if (countdownEl) {
      countdownEl.textContent = `Nueva solicitud disponible en ${remaining}s`
      countdownEl.classList.remove("hidden")
    }
    if (this.helpInterval) {
      clearInterval(this.helpInterval)
      this.helpInterval = null
    }
    this.helpInterval = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        if (countdownEl) {
          countdownEl.textContent = `Nueva solicitud disponible en ${remaining}s`
        }
      } else {
        clearInterval(this.helpInterval)
        this.helpInterval = null
        btn.disabled = false
        btn.textContent = "Solicitar Ayuda"
        feedback.classList.add("hidden")
        if (countdownEl) {
          countdownEl.classList.add("hidden")
        }
      }
    }, 1000)

    try {
      const result = await API.post("/alertas", {
        cama_id: this.camaId,
        paciente_id: this.pacienteData.id,
        paciente: this.pacienteData.nombre,
        isla_id: this.pacienteData.isla_id,
        tipo: "ayuda",
        timestamp: new Date().toISOString(),
      })

      const alert = {
        id: result && result.success && result.data && result.data.id ? result.data.id : Date.now().toString(),
        cama_id: this.camaId,
        paciente: this.pacienteData.nombre,
        tipo: "ayuda",
        timestamp: new Date().toISOString(),
      }

      try {
        const enfermeros = await API.get("/enfermeros")
        if (enfermeros.success) {
          const nurse = (enfermeros.data || []).find((e) => Array.isArray(e.camas) && e.camas.includes(this.camaId))
          if (nurse) {
            alert.nurse_id = nurse.id
            alert.nurse_token = nurse.fcm_token || null
          }
        }
      } catch {}

      const raw = localStorage.getItem("alertas")
      const arr = raw ? JSON.parse(raw) : []
      localStorage.setItem("alertas", JSON.stringify([alert, ...arr]))

      if (alert.nurse_id && alert.nurse_token) {
        const notifyPayload = {
          nurse_id: alert.nurse_id,
          token: alert.nurse_token,
          notification: {
            title: "Nueva solicitud de ayuda",
            body: `Cama ${alert.cama_id} - ${this.pacienteData.nombre}`,
          },
          data: {
            alert_id: alert.id,
            cama_id: alert.cama_id,
            paciente: this.pacienteData.nombre,
            paciente_id: this.pacienteData.id,
            isla_id: this.pacienteData.isla_id,
          },
        }
        try { await API.post("/notify", notifyPayload) } catch {}
      }

      if (result.success) {
        // Mostrar confirmación
        feedback.textContent = "✓ Solicitud enviada. El personal se acercará pronto."
        feedback.classList.remove("hidden")
        showToast("Solicitud de ayuda enviada", "success")

        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification("Solicitud Enviada", {
              body: "Tu solicitud de ayuda ha sido registrada",
              tag: "help-request",
            })
          })
        }
      } else {
        showToast("Error al enviar solicitud", "error")
      }
    } catch (error) {
      showToast("Error de conexión", "error")
      console.error("[v0] Error:", error)
    }

    if (this.helpTimeout) {
      clearTimeout(this.helpTimeout)
      this.helpTimeout = null
    }
  }
  async startQRAuth() {
    const overlay = document.getElementById("qr-auth")
    const video = document.getElementById("qr-video")
    const errorEl = document.getElementById("qr-error")
    if (!overlay || !video) return
    overlay.classList.remove("hidden")

    const supported = "BarcodeDetector" in window
    if (!supported && window.Html5Qrcode) {
      const readerEl = document.getElementById("qr-reader")
      if (readerEl) {
        video.style.display = "none"
        this.html5Qr = new window.Html5Qrcode("qr-reader")
        this.html5Qr
          .start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (raw) => {
            this.stopQRAuth()
            if (/^https?:\/\//.test(raw)) {
              window.location.href = raw
              return
            }
            try {
              const u = new URL(raw)
              const cama = u.searchParams.get("cama_id")
              const token = u.searchParams.get("token")
              if (cama && token) {
                window.location.href = `${window.location.origin}/paciente.html?cama_id=${encodeURIComponent(cama)}&token=${encodeURIComponent(token)}`
              }
            } catch (_) {}
          })
          .catch(() => {
            if (errorEl) {
              errorEl.textContent = "No se pudo iniciar la cámara para escanear QR."
              errorEl.style.display = "block"
            }
          })
        return
      }
    }
    if (!supported) {
      if (errorEl) {
        errorEl.textContent = "Tu navegador no soporta escaneo QR."
        errorEl.style.display = "block"
      }
      return
    }

    try {
      this.qrDetector = new window.BarcodeDetector({ formats: ["qr_code"] })
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = "No fue posible iniciar el detector de QR."
        errorEl.style.display = "block"
      }
      return
    }

    try {
      this.qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      video.srcObject = this.qrStream
      await video.play()
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = "No se pudo acceder a la cámara."
        errorEl.style.display = "block"
      }
      return
    }

    const detect = async () => {
      if (!this.qrDetector) return
      try {
        const codes = await this.qrDetector.detect(video)
        if (codes && codes.length > 0) {
          const raw = codes[0].rawValue || ""
          if (raw) {
            this.stopQRAuth()
            if (/^https?:\/\//.test(raw)) {
              window.location.href = raw
              return
            }
            try {
              const u = new URL(raw)
              const cama = u.searchParams.get("cama_id")
              const token = u.searchParams.get("token")
              if (cama && token) {
                window.location.href = `${window.location.origin}/paciente.html?cama_id=${encodeURIComponent(cama)}&token=${encodeURIComponent(token)}`
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    this.qrInterval = setInterval(detect, 500)
  }

  stopQRAuth() {
    const overlay = document.getElementById("qr-auth")
    const video = document.getElementById("qr-video")
    if (overlay) overlay.classList.add("hidden")
    if (this.qrInterval) {
      clearInterval(this.qrInterval)
      this.qrInterval = null
    }
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks()
      tracks.forEach((t) => t.stop())
      video.srcObject = null
    }
    if (this.html5Qr) {
      try { this.html5Qr.stop().catch(() => {}) } catch (_) {}
      try { this.html5Qr.clear() } catch (_) {}
      this.html5Qr = null
    }
    this.qrDetector = null
    this.qrStream = null
  }
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  new Paciente()
})
