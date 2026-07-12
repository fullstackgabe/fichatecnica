const fs = require('fs')
const path = require('path')

const DIST = 'dist'
const from = path.join(DIST, 'assets', 'node_modules')
const to = path.join(DIST, 'assets', 'vendor')

if (!fs.existsSync(from)) {
  console.log('fix-icons: nada a mover')
  process.exit(0)
}

fs.rmSync(to, { recursive: true, force: true })
fs.renameSync(from, to)

const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f)
    if (fs.statSync(fp).isDirectory()) walk(fp)
    else if (/\.(js|html|json)$/.test(f)) {
      const c = fs.readFileSync(fp, 'utf8')
      if (c.includes('assets/node_modules')) {
        fs.writeFileSync(fp, c.split('assets/node_modules').join('assets/vendor'))
      }
    }
  }
}
walk(DIST)

console.log('fix-icons: assets/node_modules -> assets/vendor OK')
