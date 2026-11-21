---
name: weekly-report
description: 将用户提供的一周工作记录整理成 Markdown 周报。适用于需要汇总已交付成果、阻塞事项和下周安排的场景。
license: MIT (see core/LICENSE.txt)
---

# 生成周报

向用户确认报告周期、读者和项目，再从用户提供的记录提取事实。每项进展尽量对应交付物、日期或可检查的结果。将尚未确认的数据保留为“待补充”。

基础版使用“本周交付”“待解决事项”“下周安排”三个小节。如果本安装包包含 `templates/`，可按用户的工作类型选用其中一份 Markdown 模板；仅使用当前包中实际存在的文件。

整理出报告标题和各小节条目后，从本 Skill 目录导入 `core/report.mjs` 的 `renderReport` 函数。它接受标题字符串和小节数组，返回 Markdown 字符串。调用形式如下。

```js
import { renderReport } from './core/report.mjs'

const markdown = renderReport({
  title: '项目周报',
  sections: [
    { heading: '本周交付', entries: ['已完成的交付物及验收记录'] },
    { heading: '待解决事项', entries: ['需要协作方确认的具体问题'] },
    { heading: '下周安排', entries: ['负责人、行动及目标日期'] }
  ]
})
```

可运行 `node core/report.mjs` 检查转换器的示例输出。向用户交付填写后的 Markdown，检查负责人、数字和日期均来自其提供的材料。
