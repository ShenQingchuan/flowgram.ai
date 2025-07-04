# 7. 物料系统 (Materials System)

在 `flowgram.ai` 中，"物料 (Materials)" 是一个核心概念，它指的是所有构成画布UI的、可被替换和配置的React组件。这套系统使得用户可以轻松地定制编辑器的外观和感觉，而无需修改核心库的代码。

## 7.1 设计思想：注册与消费

物料系统的核心思想是经典的**服务注册与消费**模式，也常被称为"服务定位器模式"。

1.  **定义标准**: 首先，系统定义了一系列标准的"渲染Key"（`FlowRendererKey`），例如 `NODE_RENDER` (节点渲染), `ADDER` (添加按钮), `COLLAPSE` (折叠按钮) 等。这些 Key 就像一个个预留的"插槽"。
2.  **注册 (Registration)**: 用户或上层封装库（如 `@flowgram.ai/fixed-semi-materials`）通过一个插件 (`createMaterialsPlugin`)，将自己实现的 React 组件注册到对应的"插槽"里。
3.  **消费 (Consumption)**: 渲染引擎在工作时（例如 `FlowNodesContentLayer` 在渲染节点时），它不直接依赖于任何具体的组件实现。相反，它会向一个中心化的注册表服务 (`FlowRendererRegistry`) 查询："请给我 `NODE_RENDER` 这个插槽对应的组件"。
4.  **渲染 (Rendering)**: 渲染引擎拿到查询到的组件后，将其渲染出来。

通过这种方式，渲染逻辑和UI组件实现被完全解耦。

## 7.2 核心模块

### `createMaterialsPlugin`

这是物料系统的入口插件，位于 `packages/plugins/materials-plugin`。它的职责非常单一：

-   接收一个 `MaterialsPluginOptions` 对象作为配置。这个对象包含了用户想要注册的所有物料，例如：
    ```typescript
    {
      // 注册默认的节点渲染组件
      renderDefaultNode: MyCustomNodeComponent,
      // 注册其他具名组件
      components: {
        [FlowRendererKey.ADDER]: MyCustomAdder,
      },
      // 注册需要国际化的文本
      renderTexts: {
        [FlowTextKey.LOOP_END_TEXT]: '循环结束',
      }
    }
    ```
-   在 `onInit` 生命周期钩子中，它从 DI 容器中获取 `FlowRendererRegistry` 服务。
-   调用 `registry.registerReactComponent()` 和 `registry.registerText()`，将用户配置的物料和文本注册到注册表中。

### `FlowRendererRegistry`

这是物料系统的核心服务，位于 `packages/canvas-engine/renderer`。它本质上是一个单例的注册表。

-   **`componentsMap`**: 内部维护一个 `Map` 对象，`key` 是渲染 Key (如 `FlowRendererKey.NODE_RENDER`)，`value` 是一个包含组件类型和组件本身的 `FlowRendererComponent` 对象。
-   **`textMap`**: 另一个 `Map` 对象，用于存储可本地化的文本。
-   **`registerReactComponent(key, component)`**: `materials-plugin` 调用的主要方法，用于向 `componentsMap` 中注册物料。
-   **`getRendererComponent(key)`**: 渲染引擎调用的主要方法，用于从 `componentsMap` 中获取物料。如果找不到，会抛出错误。
-   **`getText(key)`**: 获取文本的方法，它会优先尝试从 `i18n` 服务中获取翻译，如果失败，再从自身的 `textMap` 中获取默认值。

## 7.3 工作流程示例：渲染一个节点

1.  **应用启动**:
    -   用户在 `editorProps` 中传入 `materials` 配置，指定了 `renderDefaultNode` 为 `MyBaseNode` 组件。
    -   `createDefaultPreset` 调用 `createMaterialsPlugin`，将该配置传入。
    -   `materials-plugin` 的 `onInit` 被触发，它调用 `FlowRendererRegistry.registerReactComponent('node-render', MyBaseNode)`。

2.  **画布渲染**:
    -   渲染引擎开始工作，`FlowNodesContentLayer` 被执行。
    -   `FlowNodesContentLayer` 需要渲染一个节点。它不会硬编码任何组件，而是向 `FlowRendererRegistry` 请求。
    -   它调用 `registry.getRendererComponent(FlowRendererKey.NODE_RENDER)`。
    -   `FlowRendererRegistry` 从其 `componentsMap` 中查找到 `MyBaseNode` 组件并返回。
    -   `FlowNodesContentLayer` 拿到 `MyBaseNode` 组件后，传入必要的 `props`（如节点数据）并将其渲染出来。

## 总结

物料系统是 `flowgram.ai` 实现高度可定制化的关键。它通过一个中心化的注册表 (`FlowRendererRegistry`) 和一个负责填充注册表的插件 (`createMaterialsPlugin`)，优雅地将渲染逻辑与UI实现解耦。这种设计使得更换主题、替换核心交互组件、甚至是对接不同的UI库（如从 `Semi Design` 切换到 `Ant Design`）都成为可能，而无需触动底层的核心渲染逻辑。
