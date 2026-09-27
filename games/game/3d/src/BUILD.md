# 3D 版构建说明

发布产物是自包含的 `game/3d/index.html`（three.js 已内联，支持 file:// 直接打开）。
修改逻辑请编辑 `src/main.js`，然后重新打包内联：

```bash
npm pack three@0.185.1 && tar xzf three-*.tgz     # 获取 three（含 build/three.module.min.js 与 three.core.min.js）
npx esbuild src/main.js --bundle --minify --format=iife \
  --alias:three=./package/build/three.module.min.js --outfile=bundle.js
# 再把 bundle.js 替换进 src/template.html 的 <!--BUNDLE--> 占位符，输出为 index.html
```
