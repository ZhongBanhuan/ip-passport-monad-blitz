import { keccak256, sha256, stringToHex } from 'viem'
import catalogData from './catalog.json' with { type: 'json' }

export const catalog = catalogData
export const ruleVersion = 'skill-distribution/1'
const digest = /^0x[0-9a-f]{64}$/i
const isDigest = value => typeof value === 'string' && digest.test(value)
const address = /^0x[0-9a-f]{40}$/i
const nilAddress = /^0x0{40}$/i
const noticePath = 'core/LICENSE.txt'
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
const realAddress = value => typeof value === 'string' && address.test(value) && !nilAddress.test(value)
const hashText = text => sha256(stringToHex(text))
const ordered = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0

export function buildManifest(includeTemplates = true, includeNotice = true) {
  const selected = includeTemplates ? [catalog.components.core, catalog.components.templates] : [catalog.components.core]
  return {
    components: selected.map(({ id, version }) => ({ id, version })),
    files: [catalog.wrapper, ...selected.flatMap(c => c.files)]
      .filter(f => includeNotice || f.path !== noticePath)
      .map(({ path, sha256 }) => ({ path, sha256 })).sort(ordered),
  }
}

function checkGrant(input, context) {
  if (context.chainError) return ['review', '链上记录暂时无法核对，请恢复连接后重试。']
  if (input.grantId && !isDigest(input.grantId)) return ['blocked', '授权凭证编号格式无效。']
  if (!input.grantId || !context.grant) return ['blocked', '此项目缺少模板随包商业分发授权。购买授权或移除模板。']
  if (!realAddress(input.buyer)) return ['blocked', '请提供凭证对应的买方钱包地址。']
  const g = context.grant
  if (!realAddress(context.contract) || !realAddress(context.issuer) || !context.chainId) {
    return ['review', '缺少可信合约、签发地址或网络配置。']
  }
  if (Number(g.chainId) !== Number(context.chainId) || !same(g.contract, context.contract) ||
      !same(g.issuer, context.issuer) || !same(g.id, input.grantId) ||
      !isDigest(g.offerId) || (context.offerId && !same(g.offerId, context.offerId))) {
    return ['blocked', '凭证的来源、报价或签发方与核验配置不匹配。']
  }
  if (!same(input.buyer, g.buyer)) return ['blocked', '凭证与当前买方不匹配。']
  if (!same(g.projectHash, keccak256(stringToHex(input.projectId.trim())))) return ['blocked', '凭证与当前项目不匹配。']
  const component = catalog.components.templates
  if (!same(g.workId, component.workId) || !same(g.version, component.version) ||
      !same(g.termsHash, catalog.termsHash) || String(g.priceWei) !== catalog.priceWei) {
    return ['blocked', '凭证的作品、版本、价格或许可条款不匹配。']
  }
  return ['ready', '项目、买方、版本与链上商业分发授权一致。']
}

export function evaluateCheck(input, context = {}) {
  const items = []
  let packageHash = null
  const add = (id, status, reason) => items.push({ id, status, reason })
  function result() {
    const issues = items.filter(row => row.status !== 'ready')
    const decision = issues.some(row => row.status === 'review') ? 'review' : issues.length ? 'blocked' : 'ready'
    return { decision, items, issues: issues.map(row => row.reason), packageHash, ruleVersion }
  }
  if (!input || typeof input.projectId !== 'string' || !input.projectId.trim() || input.projectId.length > 200 ||
      !Array.isArray(input.components) || !input.components.length || input.components.length > 100 ||
      !Array.isArray(input.files) || input.files.length > 1000) {
    add('manifest', 'review', '请输入项目标识，并提供完整的组件与文件清单。')
    return result()
  }
  if (input.purpose !== catalog.purpose) add('purpose', 'review', '当前自动规则仅覆盖随收费 Skill 分发的用途。')
  const fileMap = new Map()
  for (const file of input.files) {
    if (!file || typeof file.path !== 'string' || fileMap.has(file.path) || !isDigest(file.sha256)) {
      add('manifest', 'review', '发现重复路径、缺少路径或无效文件摘要。')
      return result()
    }
    fileMap.set(file.path, file.sha256.toLowerCase())
  }
  packageHash = hashText(JSON.stringify([...input.files].sort(ordered).map(f => [f.path, f.sha256.toLowerCase()])))
  const selected = new Set()
  const declaredPaths = new Set([catalog.wrapper.path])
  if (!same(fileMap.get(catalog.wrapper.path), catalog.wrapper.sha256)) {
    add('SKILL.md', 'review', '缺少周报 Skill 入口文件，或该文件与发布方登记的指纹不符。')
  }
  for (const entry of input.components) {
    const id = entry?.id
    if (typeof id !== 'string' || !Object.hasOwn(catalog.components, id)) {
      const reason = id === 'Apache-2.0' || entry?.license === 'Apache-2.0'
        ? 'Apache-2.0 需人工核对许可副本、修改标注、相关声明及适用的 NOTICE。'
        : '未识别的组件或许可。请提交来源和权利材料供人工复核。'
      add(typeof id === 'string' ? id : 'manifest', 'review', reason)
      continue
    }
    const component = catalog.components[id]
    if (selected.has(id)) add(id, 'review', '清单重复声明了同一组件。')
    selected.add(id)
    let contentIssue = false
    for (const file of component.files) {
      declaredPaths.add(file.path)
      if (id === 'core' && file.path === noticePath) continue
      if (!same(fileMap.get(file.path), file.sha256)) contentIssue = true
    }
    if (!same(entry.version, component.version) || contentIssue) {
      add(id, 'review', '版本或文件指纹与固定源码不一致，请核对实际分发材料。')
    } else if (id === 'core') {
      const notice = component.files.find(f => f.path === noticePath)
      if (same(fileMap.get(noticePath), notice.sha256)) add(id, 'ready', '允许商业分发，清单包含完整的 MIT 版权及许可声明。')
      else add(id, 'blocked', '可商用。请附上原版 MIT 版权与许可声明后重新核验。')
    } else {
      add(id, ...checkGrant(input, context))
    }
  }
  if (!selected.has('core')) add('manifest', 'review', '此示例发布包应包含 Markdown 转换器。')
  if ([...fileMap.keys()].some(path => !declaredPaths.has(path))) {
    add('manifest', 'review', '清单含未被已声明组件覆盖的文件，请核对组件归属。')
  }
  return result()
}
