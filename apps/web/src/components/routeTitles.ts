const appName = 'Character Forge'

export function getRouteTitle(pathname: string) {
  if (pathname === '/') return appName
  if (pathname === '/forge') return `Forge a character | ${appName}`
  if (/^\/forge\/[^/]+$/.test(pathname)) return `Character builder | ${appName}`
  if (pathname === '/characters') return `My characters | ${appName}`
  if (/^\/characters\/[^/]+\/sheet$/.test(pathname)) return `Character sheet | ${appName}`
  if (pathname.startsWith('/compendium/')) return `Compendium entry | ${appName}`
  if (pathname === '/compendium') return `Compendium | ${appName}`
  if (pathname === '/attributions') return `Attributions | ${appName}`
  return `Page not found | ${appName}`
}

export function getRouteAnnouncement(pathname: string) {
  return getRouteTitle(pathname).replace(` | ${appName}`, '')
}
