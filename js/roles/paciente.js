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
    this.init()
  }

  async init() {
    if (!this.camaId || !this.token) {
      this.showScannerUI()
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
      this.renderPacienteInfo()
      contentDiv.classList.remove("hidden")
      document.getElementById("paciente-login")?.classList.add("hidden")
      Session.setUser && Session.setUser({ role: "paciente", id: this.pacienteData.id, nombre: this.pacienteData.nombre })
      Session.setToken && Session.setToken("token-" + Date.now())
    } else {
      errorDiv.classList.remove("hidden")
      contentDiv.classList.add("hidden")
      this.showScannerUI()
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

  showScannerUI() {
    const box = document.getElementById("paciente-login")
    const btn = document.getElementById("btn-scan-qr")
    const modal = document.getElementById("scanner-modal")
    const closeBtn = document.getElementById("btn-close-scanner")
    if (box) box.classList.remove("hidden")
    btn && btn.addEventListener("click", () => {
      modal && modal.classList.remove("hidden")
      this.startQrScanner()
    })
    closeBtn && closeBtn.addEventListener("click", () => {
      modal && modal.classList.add("hidden")
      this.stopQrScanner()
    })
  }

  startQrScanner() {
    const video = document.getElementById("qr-video")
    const canvas = document.getElementById("qr-canvas")
    const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null
    const constraints = { video: { facingMode: "environment" } }
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        this.qrStream = stream
        video.srcObject = stream
        this.qrInterval = setInterval(() => {
          if (!ctx) return
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
    let cama = null
    let token = null
    try {
      const mC = text.match(/cama_id=([^&]+)/)
      const mT = text.match(/token=([^&]+)/)
      cama = mC && mC[1]
      token = mT && mT[1]
    } catch {}
    if (!cama || !token) return
    this.stopQrScanner()
    const modal = document.getElementById("scanner-modal")
    modal && modal.classList.add("hidden")
    this.camaId = cama
    this.token = token
    this.validateToken()
  }

  async solicitarAyuda() {
    const btn = document.getElementById("btn-solicitar-ayuda")
    const feedback = document.getElementById("help-feedback")

    // Deshabilitar botón por 60 segundos
    btn.disabled = true
    btn.textContent = "Solicitud enviada..."

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
        if (window.db && window.firestore) {
          const { collection, query, where, getDocs } = window.firestore
          const q = query(collection(window.db, "enfermeros"), where("camas", "array-contains", this.camaId))
          const snap = await getDocs(q)
          const docItem = snap.docs[0]
          if (docItem) alert.nurse_id = docItem.id
        }
      } catch {}

      // Persistencia en Firestore manejada arriba; sin almacenamiento provisional local

      if (alert.nurse_id) {
        const notifyPayload = {
          nurse_id: alert.nurse_id,
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

    // Reactivar botón después de 60 segundos
    this.helpTimeout = setTimeout(() => {
      btn.disabled = false
      btn.textContent = "Solicitar Ayuda"
      feedback.classList.add("hidden")
    }, 60000)
  }
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  new Paciente()
})
