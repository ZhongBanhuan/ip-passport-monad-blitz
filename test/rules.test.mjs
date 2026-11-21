import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { keccak256, stringToHex } from 'viem'
import { evaluateCheck, buildManifest, catalog } from '../lib/rules.mjs'
import { encodeRelease, inspectRelease } from '../lib/release.mjs'
import { unzipSync, strFromU8 } from 'fflate'

const buyer = '0x' + '1'.repeat(40)
const issuer = '0x' + '2'.repeat(40)
const contract = '0x' + '3'.repeat(40)
const grantId = '0x' + 'a'.repeat(64)
const offerId = '0x' + 'b'.repeat(64)
const projectId = 'weekly-report'
const make = (templates, notice) => ({ projectId, purpose: catalog.purpose, ...buildManifest(templates, notice) })
const purchase = { ...make(true, true), buyer, grantId }
const grant = {
  id: grantId, offerId, buyer, issuer, contract, chainId: 10143,
  projectHash: keccak256(stringToHex(projectId)), workId: catalog.components.templates.workId,
  version: catalog.components.templates.version, termsHash: catalog.termsHash, priceWei: catalog.priceWei,
}
const trusted = { grant, chainId: 10143, contract, issuer, offerId }

test('basic distribution requires intact MIT notice, wallet optional', () => {
  assert.equal(evaluateCheck(make(false, true)).decision, 'ready')
  assert.equal(evaluateCheck(make(false, false)).decision, 'blocked')
  const wrong = make(false, true)
  wrong.files.find(f => f.path.endsWith('LICENSE.txt')).sha256 = grantId
  assert.equal(evaluateCheck(wrong).decision, 'blocked')
})
test('only a trusted chain lookup can authorize commercial templates', () => {
  assert.equal(evaluateCheck({ ...purchase, grant }).decision, 'blocked')
  assert.equal(evaluateCheck(purchase, trusted).decision, 'ready')
  assert.equal(evaluateCheck(purchase, { ...trusted, chainError: true }).decision, 'review')
  assert.equal(evaluateCheck({ ...purchase, projectId: 'second-skill' }, trusted).decision, 'blocked')
  assert.equal(evaluateCheck({ ...purchase, buyer: issuer }, trusted).decision, 'blocked')
  for (const [field, value] of Object.entries({ chainId: 1, id: offerId, issuer: buyer, contract: buyer,
    termsHash: grantId, version: grantId, workId: grantId, priceWei: '0', offerId: grantId })) {
    assert.equal(evaluateCheck(purchase, { ...trusted, grant: { ...grant, [field]: value } }).decision, 'blocked', field)
  }
})
test('missing versions, undeclared files, duplicate paths and unsupported uses fail closed', () => {
  const cases = [
    input => { input.components = [] },
    input => { input.components[0].version = grantId },
    input => { input.components.push(input.components[0]) },
    input => { input.files.push(input.files[0]) },
    input => { input.files[0].path = '../injected' },
    input => { input.files = [] },
    input => { input.files = input.files.filter(file => file.path !== 'SKILL.md') },
    input => { input.files.find(file => file.path === 'SKILL.md').sha256 = grantId },
    input => { input.components.pop() },
    input => { input.components.push({ id: 'constructor' }) },
    input => { input.purpose = 'resell-templates' },
  ]
  for (const change of cases) {
    const input = structuredClone(purchase)
    change(input)
    assert.equal(evaluateCheck(input, trusted).decision, 'review')
  }
})
test('catalog hashes reproduce from original bytes, stable manifest ordering', () => {
  const digest = text => '0x' + createHash('sha256').update(text).digest('hex')
  for (const component of Object.values(catalog.components)) {
    for (const file of component.files) assert.equal(digest(file.text), file.sha256)
    assert.equal(digest(JSON.stringify(component.files.map(f => [f.path, f.sha256]))), component.version)
  }
  assert.equal(digest(catalog.termsText), catalog.termsHash)
  assert.equal(digest(catalog.wrapper.text), catalog.wrapper.sha256)
  assert.equal(catalog.components.templates.workId, keccak256(stringToHex('ip-passport/report-templates')))
  assert.equal(catalog.components.templates.files.filter(f => f.path.endsWith('.md')).length, 12)
  const reversed = { ...purchase, files: [...purchase.files].reverse() }
  assert.equal(evaluateCheck(purchase).packageHash, evaluateCheck(reversed).packageHash)
})

test('basic and licensed distributions include a loadable Skill with the registered wrapper', () => {
  for (const input of [make(false, true), purchase]) {
    const zip = encodeRelease(input.files)
    const entries = unzipSync(zip)
    const skill = strFromU8(entries['SKILL.md'])
    assert.equal(skill, catalog.wrapper.text)
    assert.match(skill, /^---\nname: weekly-report\n/)
    assert.ok(entries['core/report.mjs'])
    assert.equal(Boolean(entries['templates/product.md']), input === purchase)
    const rebuilt = inspectRelease(zip)
    assert.equal(evaluateCheck({ ...input, ...rebuilt }, trusted).decision, 'ready')
  }
})
