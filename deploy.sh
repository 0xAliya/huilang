#!/bin/sh
# 构建并把 dist 推到 gh-pages 分支（GitHub Pages 从该分支发布）
set -e
cd "$(dirname "$0")"
npm test
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "deploy $(date +%Y-%m-%d\ %H:%M)"
git push -f -q "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "已推送到 gh-pages"
