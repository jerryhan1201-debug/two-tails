# Two Tails

A cooperative exploration game built with TypeScript, Babylon.js, Vite and WebSocket. This repository publishes general-purpose source code from the 0.18.9 development snapshot under the MIT License.

双人探索游戏的通用代码。**公开版不包含角色、美术、音乐、场景几何或从素材提取的碰撞数据，因此不能直接构建或启动完整游戏。** 可独立执行的工具模块检查与测试见下文。素材接口与缺失范围见 [ASSETS.md](ASSETS.md)。

## 源码内容

- 双人房间、输入传输、网络快照和断线恢复。
- 存档校验、故事投票和章节进度。
- 移动、碰撞、飞行、游泳、伙伴交互的实现代码。
- Babylon.js 场景、相机、渲染、天气、资源预算与 UI 接入代码。

## 安装与独立验证

需要 Node.js 22+ 与 npm。

```sh
npm ci
npm run check
npm test
```

`check` 检查可脱离素材运行的工具模块及其测试。默认测试仅覆盖独立模块，不表示完整游戏或后端在缺失场景数据时可直接运行。

## 接入自有素材后开发

自行制作或取得有适当授权的素材和场景数据，按源码接口接入后，可使用：

```sh
npm run dev:game
HOST=127.0.0.1 PORT=8787 npm run server:game
npm run build:game
```

`build:game` 会先检查缺失入口。前端通过 `/api` 和 `/ws` 连接后端；协议定义在 `shared/protocol.ts`。游戏后端的默认存档目录 `.game-data/` 已忽略。`wrangler.jsonc` 仅是使用自己 Cloudflare 账号部署的配置参考。

`npm run test:game` 保留了历史游戏回归用例，其中含有未公开目录、场景或模型依赖，也存在历史断言偏差，不属于公开版通过范围。

## 目录

| 目录 | 内容 |
| --- | --- |
| `server/` | 房间、WebSocket 服务、存储和访问保护源码 |
| `shared/` | 协议、存档、快照、进度与逻辑源码 |
| `src/` | 玩法、相机、渲染与界面源码 |
| `tests/` | 独立工具测试与历史游戏回归源码 |
| `tools/` | 素材入口检查 |

公开显示名称为 **Two Tails**。源码内保留部分旧版 `goulai.*` 存档/故事 ID，以维持格式与接口的兼容性。

## 许可与数据边界

原创通用代码使用 [MIT License](LICENSE)。第三方依赖保留其各自许可。本许可不授予任何第三方角色形象、模型、音乐或其他素材的权利。公开版移除了真实密钥、私人存档、口令、参考图、媒体文件、场景几何和素材派生数据。详细范围见 [ASSETS.md](ASSETS.md)，验证结果见 [VALIDATION.md](VALIDATION.md)。
