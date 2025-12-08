document.addEventListener("DOMContentLoaded", () => {
  const lista = document.getElementById("lista-islas")
  const modal = document.getElementById("modal")
  const btnAdd = document.getElementById("btn-add-isla")
  const btnClose = document.getElementById("btn-close-modal")
  const form = document.getElementById("form-modal")
  const loginBox = document.getElementById("superadmin-login")
  const loginForm = document.getElementById("superadmin-login-form")

  const accountRaw = localStorage.getItem("superadmin_account")
  if (!accountRaw) {
    localStorage.setItem(
      "superadmin_account",
      JSON.stringify({ id: "superadmin-1", username: "superadmin", password: "admin123", nombre: "Superadmin" }),
    )
  }

  const user = Session.getUser && Session.getUser()
  if (!user || user.role !== "superadmin") {
    document.querySelector(".admin-dashboard").classList.add("hidden")
    loginBox.classList.remove("hidden")
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const u = document.getElementById("su-username").value.trim()
    const p = document.getElementById("su-password").value.trim()
    const acc = JSON.parse(localStorage.getItem("superadmin_account") || "{}")
    if (u === acc.username && p === acc.password) {
      Session.setUser({ role: "superadmin", id: acc.id, nombre: acc.nombre })
      Session.setToken("demo-token-" + Date.now())
      loginBox.classList.add("hidden")
      document.querySelector(".admin-dashboard").classList.remove("hidden")
    } else {
      const toast = document.getElementById("toast")
      if (toast) {
        toast.textContent = "Credenciales inválidas"
        toast.classList.remove("hidden")
        setTimeout(() => toast.classList.add("hidden"), 2000)
      }
      return
    }
  })

  let islas = []

  async function loadIslas() {
    lista.innerHTML = ""
    const res = await API.get("/islas")
    if (res.success && Array.isArray(res.data)) {
      islas = res.data
    } else {
      const raw = localStorage.getItem("islas")
      islas = raw ? JSON.parse(raw) : []
    }
    renderIslas()
  }

  function saveLocalFallback() {
    localStorage.setItem("islas", JSON.stringify(islas))
  }

  function renderIslas() {
    lista.innerHTML = ""
    if (!islas.length) {
      const p = document.createElement("p")
      p.className = "empty-state"
      p.textContent = "Sin islas creadas"
      lista.appendChild(p)
      return
    }
    islas.forEach((isla) => {
      const card = document.createElement("div")
      card.className = "card"
      const title = document.createElement("h3")
      title.textContent = isla.nombre
      const meta = document.createElement("p")
      meta.className = "small-text"
      meta.textContent = `Ubicación: ${isla.ubicacion} · Usuario: ${isla.username}`
      card.appendChild(title)
      card.appendChild(meta)
      lista.appendChild(card)
    })
  }

  function openModal() {
    modal.classList.remove("hidden")
  }

  function closeModal() {
    modal.classList.add("hidden")
    form.reset()
  }

  btnAdd.addEventListener("click", openModal)
  btnClose.addEventListener("click", closeModal)

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    const nombre = document.getElementById("isla-nombre").value.trim()
    const username = document.getElementById("isla-username").value.trim()
    const password = document.getElementById("isla-password").value.trim()
    const ubicacion = document.getElementById("isla-ubicacion").value.trim()
    if (!nombre || !username || !password || !ubicacion) return
    const nueva = { nombre, username, password, ubicacion }
    const res = await API.post("/islas", nueva)
    if (res.success) {
      if (res.data && res.data.id) {
        islas = [res.data, ...islas]
      } else {
        islas = [{ id: Date.now().toString(), ...nueva }, ...islas]
      }
    } else {
      islas = [{ id: Date.now().toString(), ...nueva }, ...islas]
      saveLocalFallback()
    }
    renderIslas()
    closeModal()
    const toast = document.getElementById("toast")
    if (toast) {
      toast.textContent = "Isla creada"
      toast.classList.remove("hidden")
      setTimeout(() => toast.classList.add("hidden"), 2000)
    }
  })

  loadIslas()
})
