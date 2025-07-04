# 1. 项目整体架构分析

本仓库是一个基于 `pnpm` + `Rush.js` 管理的 `monorepo` 项目，包含了流程编排相关的多个核心库、插件、示例应用和文档。

## Monorepo 结构

项目主要分为以下几个顶级目录：

-   `apps/`: 存放各种示例应用，用于展示和测试核心库的功能。
-   `packages/`: 存放核心代码，是整个项目的基石。
-   `common/`: 存放 `Rush.js` 的公共配置和脚本。
-   `config/`: 存放共享的配置文件，如 `eslint`, `tsconfig`。
-   `e2e/`: 存放端到端测试。
-   `docs/`: 项目文档。

这种结构使得代码复用和统一管理变得容易，不同功能模块被拆分成独立的包，有助于解耦和维护。

## `packages/` 核心包解析

`packages/` 目录是功能的核心，可以按照职责划分为以下几个部分：

### 1. `canvas-engine`: 画布渲染引擎

这是最底层的渲染层。
-   `core`: 定义了画布（Canvas）、图层（Layer）、视口（Viewport）等最基础的概念。
-   `document`: 定义了文档模型（Document Model），可以理解为画布上所有元素的数据结构的集合。
-   `renderer`: 负责将文档模型渲染到屏幕上，处理缩放、平移等操作。
-   `fixed-layout-core` / `free-layout-core`: 分别定义了两种不同布局模式下的核心逻辑。

### 2. `client`: 编辑器客户端

这是面向用户的高阶封装，直接提供给开发者使用。
-   `editor`: 提供了通用的编辑器API。
-   `fixed-layout-editor` / `free-layout-editor`: 提供了两种布局模式的开箱即用的编辑器组件。
-   `playground-react`: 提供了一个 React 环境的组件用于快速搭建开发环境。

### 3. `node-engine`: 节点引擎

负责定义"节点"（Node）这个核心概念。
-   `node`: 定义了节点的基础接口和数据结构。
-   `form` / `form-core`: 提供了与节点关联的表单能力，用于编辑节点的属性。

### 4. `variable-engine`: 变量引擎

负责处理流程中的动态数据。
-   `variable-core`: 定义了变量、表达式等核心概念。
-   `variable-layout`: 提供了变量在界面上的展示和编辑能力。

### 5. `common`: 通用工具库

提供跨包使用的通用能力。
-   `command`: 命令模式的实现，用于封装操作，支持撤销/重做。
-   `history`: 历史记录管理。
-   `reactive`: 一个独立的响应式库，用于数据和状态管理。
-   `utils`: 工具函数集合。

### 6. `plugins`: 插件系统

提供了丰富的插件来扩展编辑器的核心功能。每个插件都是一个独立的包，例如：
-   `minimap-plugin`: 小地图。
-   `history-plugin`: 历史记录（撤销/重做）插件。
-   `shortcuts-plugin`: 快捷键支持。
-   `materials-plugin`: 物料面板插件。

### 7. `materials`: 物料库

定义了可以在画布上使用的节点物料。
-   `fixed-semi-materials`: 基于 `Semi Design` 的固定布局物料。
-   `form-antd-materials`: 基于 `Ant Design` 的表单物料。

## `apps/` 示例应用

`apps/` 目录下的项目为我们提供了如何使用 `packages/` 库的绝佳示例。
-   `demo-fixed-layout`: 固定布局模式的完整示例。
-   `demo-free-layout`: 自由布局模式的完整示例。
-   `demo-node-form`: 节点表单功能的示例。

通过分析这些示例的源码，可以快速理解如何将各个核心库组合起来，构建一个完整的流程编排应用。

## 学习建议

为了理解"它是如何完成一个流程编排画布的"，下一步的研究重点应该是：

1.  **从 `apps/demo-fixed-layout` 入手**: 分析 `app.tsx` 和 `editor.tsx`，了解一个编辑器是如何被初始化和渲染的。
2.  **追踪到 `packages/client/fixed-layout-editor`**: 查看编辑器组件的内部实现。
3.  **深入到 `packages/canvas-engine`**: 理解底层的渲染逻辑和数据模型。

通过这条路径，可以自上而下地串联起整个画布的实现细节。
