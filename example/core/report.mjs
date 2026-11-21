/** Turn weekly observations into a Markdown report. */
export function renderReport({ title, sections }) {
  if (typeof title !== 'string' || !title.trim() || !Array.isArray(sections)) {
    throw new TypeError('Provide a title and a list of sections.')
  }
  const body = sections.map(({ heading, entries }) => {
    if (typeof heading !== 'string' || !Array.isArray(entries) || !entries.every(e => typeof e === 'string')) {
      throw new TypeError('Each section needs a heading and text entries.')
    }
    return ['## ' + heading.trim(), '', ...entries.map(entry => '- ' + entry.trim())].join('\n')
  })
  return ['# ' + title.trim(), ...body].join('\n\n') + '\n'
}

if (process.argv[1]?.endsWith('report.mjs')) {
  console.log(renderReport({ title: '项目周报', sections: [{ heading: '本周交付', entries: ['填写交付物及验收依据'] }] }))
}
