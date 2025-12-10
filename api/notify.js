export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" })
    return
  }

  try {
    const serverKey = process.env.FCM_SERVER_KEY
    if (!serverKey) {
      res.status(500).json({ error: "FCM_SERVER_KEY not configured" })
      return
    }

    const { token, notification, data } = req.body || {}
    if (!token) {
      res.status(400).json({ error: "token is required" })
      return
    }

    const payload = {
      to: token,
      notification: {
        title: (notification && notification.title) || "Hospital",
        body: (notification && notification.body) || "Nueva notificación",
      },
      data: data || {},
    }

    const resp = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      res.status(resp.status).json({ error: "FCM error", detail: txt })
      return
    }

    const json = await resp.json()
    res.status(200).json({ success: true, response: json })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
