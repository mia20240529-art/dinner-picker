# 今晚吃什么

两人份家常晚餐选择器，使用纯 HTML、CSS、JavaScript 和 JSON，支持自动配餐、菜谱详情、收藏和最近吃过记录。

## GitHub Pages

本仓库通过 `.github/workflows/pages.yml` 自动部署到 GitHub Pages。把仓库的 Pages 来源设置为 **GitHub Actions**，之后每次推送到 `main` 都会自动发布。

收藏和历史只保存在访问者当前浏览器的 `localStorage` 中，不会上传到 GitHub，也不会在设备之间同步。
