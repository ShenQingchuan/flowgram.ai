# 5. 插件化架构

通过对 `flowgram.ai` 源码的深入研究，我们发现其强大的扩展能力主要源于一个设计精良的插件化架构。这个架构以 `inversify` 依赖注入为基础，以生命周期钩子为切入点，使得各项功能能够作为独立的模块进行开发和集成。

## 5.1 插件的核心定义

插件系统的所有核心类型都定义在 `packages/canvas-engine/core/src/plugin/plugin.ts` 文件中。

### `Plugin` 与 `PluginConfig`

-   **`PluginConfig<Options, Context>`**: 这是定义一个插件行为的配置对象。它不是一个类，而是一个接口，包含了插件的生命周期钩子和DI配置。
    -   `onBind(bindConfig, opts)`: 用于注册 `inversify` 模块。当插件需要提供或依赖某些服务（Service）时，就在这里进行绑定。
    -   `onInit(ctx, opts)`: 在 Playground 初始化时调用，是注册 `Layer`、`Contribution` 等资源的最佳时机。
    -   `onReady(ctx, opts)`: 在 Playground 挂载到 DOM 并准备就绪后调用，适合执行需要 DOM 的操作或事件监听。
    -   `onDispose(ctx, opts)`: 在 Playground 销毁时调用，用于清理资源、解绑事件。
    -   `onAllLayersRendered(ctx, opts)`: 在所有图层完成当次渲染后调用。

-   **`Plugin`**: 这是插件在运行时的内部表示。我们通常不直接创建它，而是通过一个工厂函数来生成。

### `definePluginCreator`: 插件工厂

我们不直接编写 `Plugin` 对象，而是使用 `definePluginCreator` 这个高阶函数来创建一个"插件创建器"。

```typescript
export function definePluginCreator<Options, CTX>(config: PluginConfig<Options, CTX>): PluginCreator<Options>
```

-   它接收一个 `PluginConfig` 对象作为参数，这个 `config` 对象描述了插件要做什么。
-   它返回一个 `PluginCreator` 函数。这个函数接收插件的 `options`（用户传入的配置），并最终返回一个 `Plugin` 实例。

这种设计模式（工厂函数）将插件的"定义"和"实例化"分离开来，使得插件可以被灵活地配置和复用。

### `createPlaygroundPlugin`: 便捷的无配置插件

这是一个基于 `definePluginCreator` 的便捷封装，用于创建不需要外部传入 `options` 的插件。我们在 `createDefaultPreset` 中看到的很多插件都是通过它创建的。

```typescript
export const createPlaygroundPlugin = (options: PluginConfig) => definePluginCreator(options)(undefined);
```

## 5.2 插件的加载与执行

插件本身只是一份"配置清单"，它需要被加载到 Playground 中才能生效。这个过程是在各个 `Preset` 函数（如 `createFixedLayoutPreset`）中完成的。

1.  **收集插件**: `Preset` 函数会调用各个插件的创建器（如 `createShortcutsPlugin(opts)`），生成一个 `Plugin` 实例数组。
2.  **加载到容器**: 这些插件实例最终被传递给 `PlaygroundReactProvider`。在其内部，它会调用 `loadPlugins` 函数。
3.  **`loadPlugins` 的工作**:
    -   遍历所有 `Plugin` 实例。
    -   调用每个插件的 `initPlugin()` 方法。这一步会将 `PluginConfig` 中定义的 `onBind` 和生命周期钩子转换成 `inversify` 的 `ContainerModule`。
    -   将所有收集到的 `ContainerModule` 加载到主 DI 容器中 (`container.load(module)`)。

至此，插件的服务被注册到了 DI 容器，插件的生命周期钩子逻辑也被注册为了 `PlaygroundContribution` 的一部分。当 Playground 运行到特定生命周期阶段时（如 `init`），就会从容器中取出所有 `PlaygroundContribution` 并执行它们对应的钩子方法（如 `onInit()`），从而执行插件的逻辑。

## 5.3 插件上下文 `PluginContext`

所有生命周期钩子都会接收一个 `PluginContext` 对象作为参数，这是插件与编辑器核心交互的入口。

-   `ctx.playground`: Playground 的主实例，可以用来操作视口、注册 `Layer` 等。
-   `ctx.container`: `inversify` 的 DI 容器实例。
-   `ctx.get<T>(...)`: 一个便捷方法，等同于 `ctx.container.get<T>(...)`，用于从容器中获取服务实例。

通过这个上下文对象，插件可以访问到 `FlowDocument`、`SelectionService`、`HistoryService` 等所有核心服务，并调用它们的方法来完成复杂的功能。

## 5.4 案例研究: `shortcuts-plugin`

为了更具体地理解插件的工作方式，我们来分析 `shortcuts-plugin` 的实现。

### `createShortcutsPlugin`

这个插件的创建器 (`packages/plugins/shortcuts-plugin/src/create-shortcuts-plugin.ts`) 非常简洁。它的 `PluginConfig` 主要做了三件事：

1.  `onBind`: 在DI容器中将 `ShortcutsRegistry` 注册为单例，并使用 `bindContributionProvider` 声明了一个名为 `ShortcutsContribution` 的"贡献点"。
2.  `onInit`: 向 Playground 注册了一个 `ShortcutsLayer`。
3.  `contributionKeys`: 告诉 DI 容器，这个插件的 `options`（即用户传入的配置）应该被注入到 `ShortcutsContribution` 这个贡献点。

### `ShortcutsRegistry` 与 "贡献 (Contribution)" 模式

`ShortcutsRegistry` (`.../shortcuts-contribution.ts`) 是这个插件的核心服务。它体现了一种非常重要的设计模式——**贡献模式 (Contribution Pattern)**。

-   **`@inject(ContributionProvider)`**: `ShortcutsRegistry` 注入了一个 `ContributionProvider`，并用 `@named(ShortcutsContribution)` 指明它关心的是 `ShortcutsContribution` 这个贡献点。
-   **`@postConstruct`**: 在 `init()` 方法（由 `@postConstruct` 注解，表示在对象创建和依赖注入完成后自动调用）中，它会遍历 `ContributionProvider` 提供的所有贡献者 (`contribs`)。
-   **`registerShortcuts(this)`**: 对于每个贡献者，它会调用其 `registerShortcuts` 方法，并将自身 (`this`, 即 `ShortcutsRegistry` 实例) 传递过去。

### 注册快捷键的流程

现在，我们来看在 `fixed-layout-preset.ts` 中注册 `Delete` 快捷键的完整流程：

1.  `createFixedLayoutPreset` 调用 `createShortcutsPlugin`，并传入一个 `registerShortcuts` 函数作为 `options`。
2.  这个 `options` 对象被 DI 容器标记为 `ShortcutsContribution`。
3.  `ShortcutsRegistry` 被实例化，它的 `init()` 方法被调用。
4.  `init()` 方法从 `ContributionProvider` 拿到了所有 `ShortcutsContribution`，其中包括了我们在第一步传入的 `options` 对象。
5.  `init()` 方法调用 `options.registerShortcuts(registry)`。
6.  我们的 `registerShortcuts` 函数被执行，它调用 `registry.addHandlers(...)`，将 `Delete` 键、`backspace` 键和一个执行删除操作的函数注册到了 `ShortcutsRegistry` 内部的一个数组中。

这个过程非常清晰地展示了解耦的威力：`shortcuts-plugin` 本身并不知道任何具体的快捷键是什么，它只提供了一个注册表 (`ShortcutsRegistry`) 和一个注册时机 (`registerShortcuts`)。所有具体的快捷键逻辑都由使用它的地方（如 `fixed-layout-preset`）来"贡献"。

### `ShortcutsLayer`: 事件监听与执行

最后，`ShortcutsLayer` (`.../layers/shortcuts-layer.tsx`) 负责实现最终的交互。

-   在 `onReady` 钩子中，它为 Playground 的 DOM 节点添加 `keydown` 事件监听。
-   当键盘事件触发时，它会遍历 `ShortcutsRegistry` 中注册的所有 `handler`。
-   使用 `isShortcutsMatch` 工具函数判断当前按键是否与 `handler` 中定义的快捷键匹配。
-   如果匹配，则执行 `handler` 的 `execute` 方法，并阻止事件冒泡。

## 总结

Flowgram.ai 的插件架构设计得非常精妙：

-   **定义与实现分离**: `definePluginCreator` 将插件的"做什么"（`PluginConfig`）和"怎么做"（具体的 Service 和 Layer 实现）清晰地分离开。
-   **依赖注入和服务化**: 核心逻辑被封装在 `Service` 中，通过 DI 容器管理，易于测试和替换。
-   **贡献模式**: 通过 `ContributionProvider` 实现了"反向依赖"，核心插件定义"扩展点"，外部模块向其"贡献"具体实现。这是一种比简单的事件订阅更结构化的扩展方式。
-   **生命周期钩子**: `onInit`, `onReady` 等钩子为插件在正确的时机执行初始化逻辑提供了保障。

这套架构是我们在 Vue 重写版本中需要重点学习和借鉴的。
