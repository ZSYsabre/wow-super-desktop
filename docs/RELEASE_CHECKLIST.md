# 交付检查清单

## 提交前

- [ ] `apps/desktop` 通过 `npm run typecheck`。
- [ ] `apps/desktop` 通过 `npm test`。
- [ ] `apps/desktop` 通过 `npm run build`。
- [ ] 仓库中不包含 `.env`、API Key、SQLite 数据库和用户文件。
- [ ] 仓库中不包含 `node_modules`、`dist` 或本地缓存。

## 新设备验证

1. 在 `apps/desktop` 执行 `npm install`。
2. 执行 `npm run dev`。
3. 导入一个 DOCX/PDF 和一张图片。
4. 验证节点拖动、缩放、连线、删除和启动恢复。
5. 配置一个 AI 服务，验证知识库问答和连线 AI 分析。

