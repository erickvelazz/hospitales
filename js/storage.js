// NUEVO: Helper de almacenamiento
window.StorageHelper = {
  getAssignedNurse(cama_id) {
    try {
      const raw = localStorage.getItem("camas")
      if (!raw) return null
      const arr = JSON.parse(raw)
      const cama = arr.find((c) => String(c.id) === String(cama_id))
      return cama && cama.enfermero ? cama.enfermero : null
    } catch {
      return null
    }
  },
}

