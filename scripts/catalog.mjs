import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const example = join(root, 'example')
const sandbox = mkdtempSync(join(tmpdir(), 'ip-passport-snapshot-'))
const env = {
  ...process.env, GIT_AUTHOR_NAME: 'IP Passport Demo Team', GIT_AUTHOR_EMAIL: 'example@ip-passport.invalid',
  GIT_COMMITTER_NAME: 'IP Passport Demo Team', GIT_COMMITTER_EMAIL: 'example@ip-passport.invalid',
  // A reproducible fixture timestamp, independent of a later blockchain registration.
  GIT_COMMITTER_DATE: '2026-11-21T00:00:00Z', GIT_AUTHOR_DATE: '2026-11-21T00:00:00Z',
}
const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], {
  cwd: sandbox, env, encoding: 'utf8',
}).trim()
const sha = bytes => '0x' + createHash('sha256').update(bytes).digest('hex')
const source = path => readFileSync(join(example, path), 'utf8')
const workIds = { // keccak256(UTF8("ip-passport/report-core" or "ip-passport/report-templates"))
  core: '0x5e206050d72cac76f0ae10185fef8db4e66ee16ff6328e16dfd4911388a9618c',
  templates: '0x2c7b4c7dc277d7596602c6473fc6c3dbdd613b8c0fc93415eeecc380904410fc',
}
try {
  for (const name of ['.gitattributes', 'README.md', 'RIGHTS.md', 'core', 'templates']) {
    cpSync(join(example, name), join(sandbox, name), { recursive: true })
  }
  git('init', '--quiet', '-b', 'main')
  git('add', '--all')
  git('commit', '--quiet', '--no-verify', '-m', 'Weekly Report Skill reference release 1.0')
  const commit = git('rev-parse', 'HEAD')
  git('bundle', 'create', join(example, 'source.bundle'), 'refs/heads/main', 'HEAD')
  const components = {}
  for (const [id, title, license] of [
    ['core', 'Markdown 转换器', 'MIT'], ['templates', '专业报告模板包', 'LicenseRef-Report-Templates'],
  ]) {
    const files = readdirSync(join(example, id)).sort().map(name => {
      const path = id + '/' + name
      const text = execFileSync('git', ['show', commit + ':' + path], { cwd: sandbox, encoding: 'utf8' })
      return { path, sha256: sha(text), text }
    })
    const version = sha(JSON.stringify(files.map(({ path, sha256 }) => [path, sha256])))
    components[id] = { id, title, license, workId: workIds[id], version, directory: id + '/', files }
  }
  const mitText = components.core.files.find(f => f.path.endsWith('LICENSE.txt')).text
  const termsText = components.templates.files.find(f => f.path.endsWith('LICENSE.txt')).text
  const sourceUrl = 'https://github.com/ZhongBanhuan/ip-passport-monad-blitz/tree/' + commit
  const wrapperText = readFileSync(join(root, 'SKILL.md'), 'utf8').replaceAll('\r\n', '\n')
  const wrapper = { path: 'SKILL.md', sha256: sha(wrapperText), text: wrapperText }
  const catalog = { commit, sourceUrl, wrapper, components, priceWei: '100000000000000000', purpose: 'paid-skill-distribution',
    mitText, termsText, termsHash: sha(termsText), rightsText: source('RIGHTS.md').replaceAll('\r\n', '\n') }
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'lib', 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
  console.log('Public reference commit', commit)
} finally {
  if (dirname(resolve(sandbox)) === resolve(tmpdir())) rmSync(sandbox, { recursive: true, force: true })
}
