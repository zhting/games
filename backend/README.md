# 游戏统一后台

萌兵军棋和干瞪眼运行在同一个 Node.js 进程、同一个端口，统一部署到腾讯云。其他游戏是静态页面，无需后台。

| 路径 | 服务 |
| --- | --- |
| `/healthz` | 统一健康检查与各游戏状态 |
| `/games/junqi/ws` | 军棋 WebSocket；兼容原 `/ws` |
| `/games/gandengyan/socket.io` | 干瞪眼 Socket.IO，支持 WebSocket 与轮询 |

两款游戏保留原来的账号、对局和计分逻辑，各自存档。此次统一的是运行与部署服务；账号体系尚未合并。

## 本地运行

在仓库根目录使用 Node.js 22 或更高版本：

```sh
npm ci
npm start
# http://localhost:3000 同时提供合集首页和两款游戏后台
npm test
```

`npm run preview` 也会挂载相同后台，并模拟 Vercel 路由。前后端同一服务时，`backend-config.js` 中 `url` 保持空字符串。

## 腾讯云部署

服务器需安装 Docker 和 Compose。为后台域名添加指向服务器的 A 记录，并在腾讯云安全组放行 TCP 80、443；3000 端口只在容器网络中使用。

在服务器上的仓库根目录执行：

```sh
cp backend/.env.example backend/.env
# 编辑 BACKEND_DOMAIN 与 GAMES_ALLOWED_ORIGINS 为真实域名
docker compose --env-file backend/.env up -d --build
docker compose --env-file backend/.env logs --tail=100 backend caddy
curl https://你的后台域名/healthz
```

Caddy 自动提供 HTTPS 和 WebSocket 反向代理。随后将前端 `backend-config.js` 的 `url` 设置为 `https://你的后台域名`，发布合集前端；军棋和干瞪眼会同时连接这个后台，无需分别配置。

也可直接访问后台域名使用完整合集，此时 `url` 留空。若直接访问后台域名，将该来源也加入 `GAMES_ALLOWED_ORIGINS`。

运行数据写入 Docker 命名卷 `game-data`：军棋为 `junqi/players.json`，干瞪眼为 `gandengyan/db.json`。更新镜像保留此卷，备份时备份整个卷。进程退出前刷新两款游戏的存档；服务重启会结束内存里的进行中对局。

## 已有数据迁移

首次上线前，若旧服务已有玩家数据，将 `games/junqi/data/players.json` 与 `games/gandengyan/data/db.json` 分别复制到统一数据目录对应路径。保留原文件，勿覆盖已经有玩家的新后台存档。

不用 Docker 时可设置 `GAMES_DATA_DIR` 指向固定目录，`PORT`、`HOST` 设置监听地址。生产环境仅运行一个后台实例；匹配房间在内存中，多个实例之间未做房间同步。
