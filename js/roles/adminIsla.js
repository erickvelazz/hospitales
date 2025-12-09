/**
 * Lógica específica para Usuario Isla (Admin)
 * - CRUD de camas, enfermeros, pacientes
 * - Generador QR
 * - Asignación visual
 */

// Usar Session y API globales de js/app.js y js/utils/api.js


class AdminIsla {
  constructor() {
    this.mockCamas = []
    this.mockEnfermeros = []
    this.mockPacientes = []
    this.currentModal = null
    this.init()
  }

  init() {
    this.checkAuth()
    this.loadData()
    this.setupEventListeners()
    this.renderAllTabs()
  }

  checkAuth() {
    const box = document.getElementById("isla-login")
    const form = document.getElementById("isla-login-form")
    const dash = document.querySelector(".admin-dashboard")

    // Credenciales por defecto para demo/local: admin/admin123 e isla/isla123
    const rawAccounts = localStorage.getItem("isla_accounts")
    if (!rawAccounts) {
      localStorage.setItem(
        "isla_accounts",
        JSON.stringify([
          { id: "admin-1", username: "admin", password: "admin123", nombre: "Administrador" },
          { id: "isla-1", username: "isla", password: "isla123", nombre: "Usuario Isla" },
        ]),
      )
    } else {
      try {
        const accs = JSON.parse(rawAccounts)
        const hasAdmin = accs.some((a) => a.username === "admin")
        if (!hasAdmin) {
          accs.push({ id: "admin-1", username: "admin", password: "admin123", nombre: "Administrador" })
          localStorage.setItem("isla_accounts", JSON.stringify(accs))
        }
      } catch {}
    }

    const user = Session.getUser && Session.getUser()
    if (!user || user.role !== "isla") {
      dash.classList.add("hidden")
      box.classList.remove("hidden")
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      const u = document.getElementById("isla-username").value.trim()
      const p = document.getElementById("isla-password").value.trim()
      let match = null
      const res = await API.get("/islas")
      if (res.success && Array.isArray(res.data)) {
        match = res.data.find((i) => i.username === u && i.password === p)
      }
      if (!match) {
        const localIslasRaw = localStorage.getItem("islas")
        const localIslas = localIslasRaw ? JSON.parse(localIslasRaw) : []
        match = localIslas.find((i) => i.username === u && i.password === p)
      }
      if (!match) {
        const accounts = JSON.parse(localStorage.getItem("isla_accounts") || "[]")
        match = accounts.find((a) => a.username === u && a.password === p)
      }
      if (match) {
        const nombre = match.nombre || "Usuario Isla"
        const id = match.id || (match.nombre ? match.nombre.toLowerCase().replace(/\s+/g, "-") : "isla")
        Session.setUser({ role: "isla", id, nombre })
        Session.setToken("demo-token-" + Date.now())
        box.classList.add("hidden")
        dash.classList.remove("hidden")
        this.loadData()
        this.renderAllTabs()
        this.updateQRIds()
      } else {
        showToast("Credenciales inválidas", "error")
      }
    })
  }

  async loadData() {
    const u = Session.getUser && Session.getUser()
    const islaId = u && u.id
    const [cRes, eRes, pRes] = await Promise.all([
      API.get("/camas", { isla_id: islaId }),
      API.get("/enfermeros", { isla_id: islaId }),
      API.get("/pacientes", { isla_id: islaId }),
    ])
    if (cRes.success) this.mockCamas = cRes.data
    if (eRes.success) this.mockEnfermeros = eRes.data
    if (pRes.success) this.mockPacientes = pRes.data
    this.renderAllTabs()
    this.updateQRIds()
  }

  setupEventListeners() {
    // Tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.switchTab(e.target.dataset.tab))
    })

    // Botones de agregar
    document.getElementById("btn-add-cama")?.addEventListener("click", () => this.openModalCama())
    document.getElementById("btn-add-enfermero")?.addEventListener("click", () => this.openModalEnfermero())
    document.getElementById("btn-add-paciente")?.addEventListener("click", () => this.openModalPaciente())

    // QR Generator
    document.getElementById("btn-generate-qr")?.addEventListener("click", () => this.generateQR())
    document.getElementById("qr-type")?.addEventListener("change", () => this.updateQRIds())

    // Modal
    document.getElementById("btn-close-modal")?.addEventListener("click", () => this.closeModal())
    document.getElementById("form-modal")?.addEventListener("submit", (e) => this.handleFormSubmit(e))
  }

  switchTab(tabName) {
    // Actualizar botones
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"))
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

    // Actualizar contenido
    document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"))
    document.getElementById(`tab-${tabName}`).classList.add("active")
  }

  // ============================================
  // MODAL MANAGEMENT
  // ============================================

  openModalCama() {
    const modal = document.getElementById("modal")
    document.getElementById("modal-title").textContent = "Nueva Cama"

    const form = document.getElementById("form-modal")
    form.innerHTML = `
      <div class="form-group">
        <label for="cama-id">ID de Cama</label>
        <input type="text" id="cama-id" placeholder="Ej: 101" required>
      </div>
      <div class="form-group">
        <label for="cama-enfermero">Asignar Enfermero</label>
        <select id="cama-enfermero">
          <option value="">Selecciona enfermero...</option>
          ${this.mockEnfermeros.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Guardar Cama</button>
    `

    modal.classList.remove("hidden")
    this.currentModal = "cama"
  }

  openModalEnfermero() {
    const modal = document.getElementById("modal")
    document.getElementById("modal-title").textContent = "Nuevo Enfermero"

    const form = document.getElementById("form-modal")
    form.innerHTML = `
      <div class="form-group">
        <label for="enfermero-nombre">Nombre</label>
        <input type="text" id="enfermero-nombre" placeholder="Nombre completo" required>
      </div>
      <div class="form-group">
        <label for="enfermero-email">Email</label>
        <input type="email" id="enfermero-email" placeholder="email@hospital.com" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Guardar Enfermero</button>
    `

    modal.classList.remove("hidden")
    this.currentModal = "enfermero"
  }

  openModalPaciente() {
    const modal = document.getElementById("modal")
    document.getElementById("modal-title").textContent = "Nuevo Paciente"

    const form = document.getElementById("form-modal")
    form.innerHTML = `
      <div class="form-group">
        <label for="paciente-nombre">Nombre</label>
        <input type="text" id="paciente-nombre" placeholder="Nombre completo" required>
      </div>
      <div class="form-group">
        <label for="paciente-cama">Asignar Cama</label>
        <select id="paciente-cama">
          <option value="">Selecciona cama...</option>
          ${this.mockCamas
            .filter((c) => c.estado === "libre")
            .map((c) => `<option value="${c.id}">${c.id}</option>`)
            .join("")}
        </select>
      </div>
      <div class="form-group">
        <label for="paciente-tratamiento">Tratamiento</label>
        <textarea id="paciente-tratamiento" placeholder="Descripción del tratamiento" rows="3"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Guardar Paciente</button>
    `

    modal.classList.remove("hidden")
    this.currentModal = "paciente"
  }

  closeModal() {
    document.getElementById("modal").classList.add("hidden")
  }

  handleFormSubmit(e) {
    e.preventDefault()

    if (this.currentModal === "cama") {
      const u = Session.getUser && Session.getUser()
      const islaId = u && u.id
      const cama = {
        id: document.getElementById("cama-id").value,
        estado: "libre",
        enfermero: document.getElementById("cama-enfermero").value,
        isla_id: islaId,
      }
      API.post("/camas", cama)
        .then((res) => {
          const created = res && res.success && res.data ? { ...cama, id: res.data.id || cama.id } : cama
          this.mockCamas.push(created)
          const raw = localStorage.getItem("camas")
          const arr = raw ? JSON.parse(raw) : []
          localStorage.setItem("camas", JSON.stringify([created, ...arr]))
          showToast("Cama agregada", "success")
          this.renderAllTabs()
        })
        .catch(() => {
          this.mockCamas.push(cama)
          const raw = localStorage.getItem("camas")
          const arr = raw ? JSON.parse(raw) : []
          localStorage.setItem("camas", JSON.stringify([cama, ...arr]))
          showToast("Cama agregada (local)", "info")
          this.renderAllTabs()
        })
    } else if (this.currentModal === "enfermero") {
      const u = Session.getUser && Session.getUser()
      const islaId = u && u.id
      const enfermero = {
        id: "E" + generateUUID().slice(0, 3).toUpperCase(),
        nombre: document.getElementById("enfermero-nombre").value,
        email: document.getElementById("enfermero-email").value,
        camas: [],
        isla_id: islaId,
      }
      API.post("/enfermeros", enfermero)
        .then((res) => {
          const created = res && res.success && res.data ? { ...enfermero, id: res.data.id || enfermero.id } : enfermero
          this.mockEnfermeros.push(created)
          const raw = localStorage.getItem("enfermeros")
          const arr = raw ? JSON.parse(raw) : []
          localStorage.setItem("enfermeros", JSON.stringify([created, ...arr]))
          showToast("Enfermero agregado", "success")
          this.renderAllTabs()
        })
        .catch(() => {
          this.mockEnfermeros.push(enfermero)
          const raw = localStorage.getItem("enfermeros")
          const arr = raw ? JSON.parse(raw) : []
          localStorage.setItem("enfermeros", JSON.stringify([enfermero, ...arr]))
          showToast("Enfermero agregado (local)", "info")
          this.renderAllTabs()
        })
    } else if (this.currentModal === "paciente") {
      const u = Session.getUser && Session.getUser()
      const islaId = u && u.id
      const paciente = {
        id: "P" + (this.mockPacientes.length + 1),
        nombre: document.getElementById("paciente-nombre").value,
        cama: document.getElementById("paciente-cama").value,
        tratamiento: document.getElementById("paciente-tratamiento").value,
        isla_id: islaId,
      }
      API.post("/pacientes", paciente)
        .then((res) => {
          const created = res && res.success && res.data ? { ...paciente, id: res.data.id || paciente.id } : paciente
          this.mockPacientes.push(created)
          const raw = localStorage.getItem("pacientes")
          const arr = raw ? JSON.parse(raw) : []
          localStorage.setItem("pacientes", JSON.stringify([created, ...arr]))
          // Actualizar cama a ocupada y asignar nombre del paciente
          const camaId = created.cama
          this.mockCamas = this.mockCamas.map((c) => (c.id === camaId ? { ...c, estado: "ocupada", paciente: created.nombre } : c))
          const rawC = localStorage.getItem("camas")
          const arrC = rawC ? JSON.parse(rawC) : []
          localStorage.setItem(
            "camas",
            JSON.stringify(arrC.map((c) => (c.id === camaId ? { ...c, estado: "ocupada", paciente: created.nombre } : c))),
          )
          API.put("/camas/" + camaId, { estado: "ocupada", paciente: created.nombre }).catch(() => {})
          showToast("Paciente agregado", "success")
          this.renderAllTabs()
        })
        .catch(() => {
          this.mockPacientes.push(paciente)
          const raw = localStorage.getItem("pacientes")
          const arr = raw ? JSON.parse(raw) : []
          localStorage.setItem("pacientes", JSON.stringify([paciente, ...arr]))
          // Actualizar cama localmente
          const camaId = paciente.cama
          this.mockCamas = this.mockCamas.map((c) => (c.id === camaId ? { ...c, estado: "ocupada", paciente: paciente.nombre } : c))
          const rawC = localStorage.getItem("camas")
          const arrC = rawC ? JSON.parse(rawC) : []
          localStorage.setItem(
            "camas",
            JSON.stringify(arrC.map((c) => (c.id === camaId ? { ...c, estado: "ocupada", paciente: paciente.nombre } : c))),
          )
          showToast("Paciente agregado (local)", "info")
          this.renderAllTabs()
        })
    } else if (this.currentModal === "cama_edit") {
      const id = this.editEntityId
      const newEnfermero = document.getElementById("cama-enfermero").value
      const camaPrev = this.mockCamas.find((c) => c.id === id)
      const prevEnfermero = camaPrev && camaPrev.enfermero
      API.put("/camas/" + id, { enfermero: newEnfermero }).then(() => {
        this.mockCamas = this.mockCamas.map((c) => (c.id === id ? { ...c, enfermero: newEnfermero } : c))
        const raw = localStorage.getItem("camas")
        const arr = raw ? JSON.parse(raw) : []
        localStorage.setItem(
          "camas",
          JSON.stringify(arr.map((c) => (c.id === id ? { ...c, enfermero: newEnfermero } : c))),
        )

        // Actualizar listas de camas en enfermeros (quitar del anterior, agregar al nuevo)
        if (prevEnfermero && prevEnfermero !== newEnfermero) {
          this.mockEnfermeros = this.mockEnfermeros.map((e) =>
            e.id === prevEnfermero ? { ...e, camas: (e.camas || []).filter((x) => x !== id) } : e,
          )
          const rawE = localStorage.getItem("enfermeros")
          const arrE = rawE ? JSON.parse(rawE) : []
          localStorage.setItem(
            "enfermeros",
            JSON.stringify(
              arrE.map((e) => (e.id === prevEnfermero ? { ...e, camas: (e.camas || []).filter((x) => x !== id) } : e)),
            ),
          )
          API.put("/enfermeros/" + prevEnfermero, { camas: (this.mockEnfermeros.find((e) => e.id === prevEnfermero)?.camas) || [] }).catch(() => {})
        }
        if (newEnfermero) {
          const target = this.mockEnfermeros.find((e) => e.id === newEnfermero)
          const updated = target ? Array.from(new Set([...(target.camas || []), id])) : [id]
          this.mockEnfermeros = this.mockEnfermeros.map((e) => (e.id === newEnfermero ? { ...e, camas: updated } : e))
          const rawE2 = localStorage.getItem("enfermeros")
          const arrE2 = rawE2 ? JSON.parse(rawE2) : []
          localStorage.setItem(
            "enfermeros",
            JSON.stringify(arrE2.map((e) => (e.id === newEnfermero ? { ...e, camas: updated } : e))),
          )
          API.put("/enfermeros/" + newEnfermero, { camas: updated }).catch(() => {})
        }

        this.renderAllTabs()
      })
    } else if (this.currentModal === "enfermero_edit") {
      const id = this.editEntityId
      const nombre = document.getElementById("enfermero-nombre").value
      const email = document.getElementById("enfermero-email").value
      API.put("/enfermeros/" + id, { nombre, email }).then(() => {
        this.mockEnfermeros = this.mockEnfermeros.map((e) => (e.id === id ? { ...e, nombre, email } : e))
        const raw = localStorage.getItem("enfermeros")
        const arr = raw ? JSON.parse(raw) : []
        localStorage.setItem(
          "enfermeros",
          JSON.stringify(arr.map((e) => (e.id === id ? { ...e, nombre, email } : e))),
        )
        this.renderAllTabs()
      })
    } else if (this.currentModal === "paciente_edit") {
      const id = this.editEntityId
      const nombre = document.getElementById("paciente-nombre").value
      const cama = document.getElementById("paciente-cama").value
      const tratamiento = document.getElementById("paciente-tratamiento").value
      const prev = this.mockPacientes.find((p) => p.id === id)
      const camaPrev = prev ? prev.cama : ""
      API.put("/pacientes/" + id, { nombre, cama, tratamiento }).then(() => {
        this.mockPacientes = this.mockPacientes.map((p) => (p.id === id ? { ...p, nombre, cama, tratamiento } : p))
        const raw = localStorage.getItem("pacientes")
        const arr = raw ? JSON.parse(raw) : []
        localStorage.setItem(
          "pacientes",
          JSON.stringify(arr.map((p) => (p.id === id ? { ...p, nombre, cama, tratamiento } : p))),
        )
        if (camaPrev && camaPrev !== cama) {
          this.mockCamas = this.mockCamas.map((c) => (c.id === camaPrev ? { ...c, estado: "libre", paciente: "" } : c))
          const rawC = localStorage.getItem("camas")
          const arrC = rawC ? JSON.parse(rawC) : []
          localStorage.setItem("camas", JSON.stringify(arrC.map((c) => (c.id === camaPrev ? { ...c, estado: "libre", paciente: "" } : c))))
          API.put("/camas/" + camaPrev, { estado: "libre", paciente: "" }).catch(() => {})
        }
        if (cama) {
          this.mockCamas = this.mockCamas.map((c) => (c.id === cama ? { ...c, estado: "ocupada", paciente: nombre } : c))
          const rawC2 = localStorage.getItem("camas")
          const arrC2 = rawC2 ? JSON.parse(rawC2) : []
          localStorage.setItem("camas", JSON.stringify(arrC2.map((c) => (c.id === cama ? { ...c, estado: "ocupada", paciente: nombre } : c))))
          API.put("/camas/" + cama, { estado: "ocupada", paciente: nombre }).catch(() => {})
        }
        this.renderAllTabs()
      })
    }

    this.closeModal()
  }

  // ============================================
  // RENDER
  // ============================================

  renderAllTabs() {
    this.renderCamas()
    this.renderEnfermeros()
    this.renderPacientes()
  }

  renderCamas() {
    const container = document.getElementById("lista-camas")
    if (!container) return

    container.innerHTML = this.mockCamas
      .map(
        (cama) => `
      <div class="card-item">
        <h3>Cama ${cama.id}</h3>
        <p><strong>Estado:</strong> ${cama.estado}</p>
        <p><strong>Enfermero:</strong> ${cama.enfermero || "—"}</p>
        <div class="card-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editCama('${cama.id}')">Editar</button>
          <button class="btn btn-secondary btn-small" onclick="admin.deleteCama('${cama.id}')">Eliminar</button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  renderEnfermeros() {
    const container = document.getElementById("lista-enfermeros")
    if (!container) return

    container.innerHTML = this.mockEnfermeros
      .map(
        (enf) => `
      <div class="card-item">
        <h3>${enf.nombre}</h3>
        <p><strong>ID:</strong> ${enf.id}</p>
        <p><strong>Camas:</strong> ${enf.camas?.join(", ") || "Sin asignar"}</p>
        <div class="card-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editEnfermero('${enf.id}')">Editar</button>
          <button class="btn btn-secondary btn-small" onclick="admin.deleteEnfermero('${enf.id}')">Eliminar</button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  renderPacientes() {
    const container = document.getElementById("lista-pacientes")
    if (!container) return

    container.innerHTML = this.mockPacientes
      .map(
        (pac) => `
      <div class="card-item">
        <h3>${pac.nombre}</h3>
        <p><strong>Cama:</strong> ${pac.cama}</p>
        <p><strong>Tratamiento:</strong> ${pac.tratamiento || "—"}</p>
        <div class="card-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editPaciente('${pac.id}')">Editar</button>
          <button class="btn btn-secondary btn-small" onclick="admin.deletePaciente('${pac.id}')">Eliminar</button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  // ============================================
  // QR GENERATION
  // ============================================

  async updateQRIds() {
    const type = document.getElementById("qr-type").value
    const select = document.getElementById("qr-id")
    const options =
      type === "paciente"
        ? this.mockPacientes.map((p) => `<option value="${p.id}">${p.nombre} (Cama ${p.cama})</option>`)
        : this.mockEnfermeros.map((e) => `<option value="${e.id}">${e.nombre}</option>`)

    select.innerHTML = `<option value="">Selecciona...</option>${options.join("")}`
  }

  generateQR() {
    const type = document.getElementById("qr-type").value
    const id = document.getElementById("qr-id").value

    if (!id) {
      showToast("Selecciona un usuario/cama", "warning")
      return
    }

    let url = ""
    if (type === "paciente") {
      const paciente = this.mockPacientes.find((p) => p.id === id)
      const token = "token_" + generateUUID()
      url = `${window.location.origin}/paciente.html?cama_id=${paciente.cama}&token=${token}`
    } else {
      url = `${window.location.origin}/enfermero.html?user_id=${id}`
    }

    this.drawQRCode(url)
    document.getElementById("qr-url-preview").textContent = `URL: ${url}`
    document.getElementById("qr-result").classList.remove("hidden")
  }

  editCama(id) {
    const c = this.mockCamas.find((x) => x.id === id)
    if (!c) return
    const modal = document.getElementById("modal")
    document.getElementById("modal-title").textContent = "Editar Cama"
    const form = document.getElementById("form-modal")
    form.innerHTML = `
      <div class="form-group">
        <label for="cama-id">ID de Cama</label>
        <input type="text" id="cama-id" value="${c.id}" disabled>
      </div>
      <div class="form-group">
        <label for="cama-enfermero">Asignar Enfermero</label>
        <select id="cama-enfermero">
          <option value="">Selecciona enfermero...</option>
          ${this.mockEnfermeros.map((e) => `<option value="${e.id}" ${c.enfermero === e.id ? "selected" : ""}>${e.nombre}</option>`).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Guardar</button>
    `
    modal.classList.remove("hidden")
    this.currentModal = "cama_edit"
    this.editEntityId = id
  }

  deleteCama(id) {
    API.delete("/camas/" + id).finally(() => {
      this.mockCamas = this.mockCamas.filter((c) => c.id !== id)
      const raw = localStorage.getItem("camas")
      const arr = raw ? JSON.parse(raw) : []
      localStorage.setItem("camas", JSON.stringify(arr.filter((c) => c.id !== id)))
      this.renderAllTabs()
    })
  }

  editEnfermero(id) {
    const e = this.mockEnfermeros.find((x) => x.id === id)
    if (!e) return
    const modal = document.getElementById("modal")
    document.getElementById("modal-title").textContent = "Editar Enfermero"
    const form = document.getElementById("form-modal")
    form.innerHTML = `
      <div class="form-group">
        <label for="enfermero-nombre">Nombre</label>
        <input type="text" id="enfermero-nombre" value="${e.nombre}" required>
      </div>
      <div class="form-group">
        <label for="enfermero-email">Email</label>
        <input type="email" id="enfermero-email" value="${e.email || ""}" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Guardar</button>
    `
    modal.classList.remove("hidden")
    this.currentModal = "enfermero_edit"
    this.editEntityId = id
  }

  deleteEnfermero(id) {
    API.delete("/enfermeros/" + id).finally(() => {
      this.mockEnfermeros = this.mockEnfermeros.filter((e) => e.id !== id)
      const raw = localStorage.getItem("enfermeros")
      const arr = raw ? JSON.parse(raw) : []
      localStorage.setItem("enfermeros", JSON.stringify(arr.filter((e) => e.id !== id)))
      this.renderAllTabs()
    })
  }

  editPaciente(id) {
    const p = this.mockPacientes.find((x) => x.id === id)
    if (!p) return
    const modal = document.getElementById("modal")
    document.getElementById("modal-title").textContent = "Editar Paciente"
    const form = document.getElementById("form-modal")
    form.innerHTML = `
      <div class="form-group">
        <label for="paciente-nombre">Nombre</label>
        <input type="text" id="paciente-nombre" value="${p.nombre}" required>
      </div>
      <div class="form-group">
        <label for="paciente-cama">Asignar Cama</label>
        <select id="paciente-cama">
          <option value="">Selecciona cama...</option>
          ${this.mockCamas.map((c) => `<option value="${c.id}" ${p.cama === c.id ? "selected" : ""}>${c.id}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label for="paciente-tratamiento">Tratamiento</label>
        <textarea id="paciente-tratamiento" rows="3">${p.tratamiento || ""}</textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Guardar</button>
    `
    modal.classList.remove("hidden")
    this.currentModal = "paciente_edit"
    this.editEntityId = id
  }

  deletePaciente(id) {
    API.delete("/pacientes/" + id).finally(() => {
      this.mockPacientes = this.mockPacientes.filter((p) => p.id !== id)
      const raw = localStorage.getItem("pacientes")
      const arr = raw ? JSON.parse(raw) : []
      localStorage.setItem("pacientes", JSON.stringify(arr.filter((p) => p.id !== id)))
      this.renderAllTabs()
    })
  }

  /**
   * Generador simple de QR usando Canvas
   * (Implementación básica sin librerías externas)
   */
  drawQRCode(text) {
    const container = document.getElementById("qr-container")
    const size = 256
    if (container) {
      container.innerHTML = ""
      if (window.QRCode && typeof window.QRCode === "function") {
        new window.QRCode(container, {
          text,
          width: size,
          height: size,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel && window.QRCode.CorrectLevel.H,
        })
        return
      }
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      canvas.width = size
      canvas.height = size
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = "#000000"
      ctx.font = "14px sans-serif"
      ctx.fillText("QR no disponible", 60, 130)
      container.appendChild(canvas)
    }
  }

  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convertir a 32-bit integer
    }
    return Math.abs(hash)
  }
}

// Inicializar
let admin
document.addEventListener("DOMContentLoaded", () => {
  admin = new AdminIsla()

  // Download QR
  document.getElementById("btn-download-qr")?.addEventListener("click", () => {
    const container = document.getElementById("qr-container")
    const canvas = container?.querySelector("canvas")
    const img = container?.querySelector("img")
    if (canvas) {
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = "qr-code.png"
      link.click()
    } else if (img) {
      const off = document.createElement("canvas")
      const size = Math.max(img.naturalWidth || 256, img.width || 256)
      off.width = size
      off.height = size
      const ctx = off.getContext("2d")
      ctx.drawImage(img, 0, 0, size, size)
      const link = document.createElement("a")
      link.href = off.toDataURL("image/png")
      link.download = "qr-code.png"
      link.click()
    }
  })
})
