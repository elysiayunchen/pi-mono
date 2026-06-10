# SOURCEMAP — Elynyx
> [derivable — 由 agent 从代码现生，见 ENGINE_MAP §0]
> Last updated: 2026-06-08 | 把这个当作 GPS，不是文档。
> ⚠️ CLI-LEAN 下本文件为 stub。agent 按需从代码库重建并核对，NEVER 信任本文件正文。


## 使用方法
- "X 逻辑在哪里？" → 直接 grep/rg 搜索代码库
- "在哪里添加新的 Y？" → 查看现有工具/模块的注册模式
- "谁调用了 Z？" → 使用 IDE 的"查找引用"或 `rg "funcName" --type ts`
- "我想做 [功能描述]" → 参考 ENGINE_MAP §3.1 关系图中的触及模块


## 1. 关键文件
> [derivable — 由 agent 从代码现生]
> 现生命令：参考 `SYSTEM.md` 中的「关键路径」和 `ARCHITECTURE.md` 中的「目录结构」
> 核心文件清单见 `engine/SYSTEM.md` §8 Key Source File Index


## 2. 模块地图
> [derivable — 由 agent 从代码现生]
> 现生命令：
> ```bash
> # 入口点
> find ~/projects/pi-mono/packages -name "index.ts" -maxdepth 3
> find ~/projects/pi-mono/elynx/src -name "index.ts" -maxdepth 2
> 
> # 核心逻辑
> ls ~/projects/pi-mono/packages/coding-agent/src/core/
> ls ~/projects/pi-mono/packages/agent/src/
> 
> # 工具
> ls ~/projects/pi-mono/packages/coding-agent/src/core/tools/
> ls ~/projects/pi-mono/elynx/src/agents/tools/
> ```


## 3. 入口点
> [derivable — 由 agent 从代码现生]


## 4. 数据流
> [derivable — 由 agent 从代码现生]


## 5. 配置注册表
> [derivable — 由 agent 从代码现生]
> 现生来源：`~/.elynx/elynx.json`、`~/.elynx/config.yaml`、`~/.elynx/.env`


## 6. 依赖图（非显而易见的）
> [derivable — 由 agent 从代码现生]


## 7. 扩展点
> [derivable — 由 agent 从代码现生]
> 参考模式：新增框架层工具 → `packages/coding-agent/src/core/tools/` + 四层注册
> 新增应用层工具 → `elynx/src/agents/tools/` + pi-tools.ts + tool-catalog.ts


## 8. 功能地图
> [derivable — 由 agent 从代码现生]


## 9. 废弃区域
> [derivable — 由 agent 从代码现生]


## 10. 文件命名规范
> [derivable — 由 agent 从代码现生]