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
    } else {
      errorDiv.classList.remove("hidden")
      contentDiv.classList.add("hidden")
      console.log("[v0] Token inválido")
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
        const enfermeros = await API.get("/enfermeros")
        if (enfermeros.success) {
          const nurse = (enfermeros.data || []).find((e) => Array.isArray(e.camas) && e.camas.includes(this.camaId))
          if (nurse) alert.nurse_id = nurse.id
        }
      } catch {}

      const raw = localStorage.getItem("alertas")
      const arr = raw ? JSON.parse(raw) : []
      localStorage.setItem("alertas", JSON.stringify([alert, ...arr]))

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
