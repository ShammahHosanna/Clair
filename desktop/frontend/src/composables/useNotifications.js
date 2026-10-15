// Clair Desktop — notifications navigateur (Web Notifications API).
// État de la permission toujours vérifié : rien n'est envoyé sans accord
// explicite, et les navigateurs sans support sont signalés, jamais masqués.
export function notifState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

export async function requestNotifPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  try {
    // doit être appelé depuis une action utilisateur (clic) pour s'afficher
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function sendNotification(title, body) {
  if (notifState() !== 'granted') return false
  try {
    const n = new Notification(title, { body, tag: 'clair-verdict', requireInteraction: false })
    n.onclick = () => { window.focus(); n.close() }
    return true
  } catch {
    return false
  }
}
