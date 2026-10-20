import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const dist = new URL('../apps/web/dist/', import.meta.url)
const html = await readFile(new URL('index.html', dist), 'utf8')
const assetPaths = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(\/assets\/[^"]+)"/g)].map(
  (match) => match[1].slice(1),
)

async function gzippedBytes(paths) {
  const contents = await Promise.all(paths.map((path) => readFile(new URL(path, dist))))
  return contents.reduce((total, content) => total + gzipSync(content).byteLength, 0)
}

const initialJavaScript = assetPaths.filter((path) => path.endsWith('.js'))
const initialStyles = assetPaths.filter((path) => path.endsWith('.css'))
const measurements = [
  {
    label: 'initial JavaScript (gzip)',
    actual: await gzippedBytes(initialJavaScript),
    budget: 125_000,
  },
  {
    label: 'initial CSS (gzip)',
    actual: await gzippedBytes(initialStyles),
    budget: 10_000,
  },
  {
    label: 'hero artwork',
    actual: (await stat(new URL('assets/hero-forge.webp', dist))).size,
    budget: 150_000,
  },
]

let failed = false
for (const measurement of measurements) {
  const result = measurement.actual <= measurement.budget ? 'PASS' : 'FAIL'
  failed ||= result === 'FAIL'
  console.log(
    `${result} ${measurement.label}: ${Math.ceil(measurement.actual / 1024)} KiB / ${Math.ceil(measurement.budget / 1024)} KiB`,
  )
}

if (failed) process.exitCode = 1
