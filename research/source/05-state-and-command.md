# 6. 状态管理与命令系统

在任何复杂的应用中，如何管理状态以及如何处理用户操作都是核心问题。`flowgram.ai` 通过几个独立的包构建了一套清晰的状态管理和命令执行机制。

## 6.1 `Reactive`: 自研的响应式系统

令人惊讶的是，`flowgram.ai` 没有直接使用 MobX 或类似的成熟库，而是在 `packages/common/reactive` 中实现了一套自己的轻量级响应式系统。

-   **核心类**: `ReactiveState<T>` 是其核心，它通过 `Proxy` 代理一个普通的对象 `T`。
-   **依赖追踪**: 内部通过一个 `Dependency` 类（来自 `tracker.ts`）实现依赖追踪。当通过代理对象访问属性时 (`get`)，当前的计算上下文会被注册为该属性的依赖。当通过代理对象设置属性时 (`set`)，所有依赖该属性的计算都会被通知并重新执行。
-   **细粒度更新**: 这是一个基于属性的（per-property）细粒度响应式系统，与 Vue 的 `ref` 和 `reactive` 的核心思想非常相似。

虽然这套系统功能相对基础，但它为上层建筑提供了最核心的"当数据变化时自动触发更新"的能力，是整个项目实现数据驱动UI的基础。

## 6.2 `Command`: 命令模式的经典实现

`packages/common/command` 包提供了一套经典的命令模式实现，其目的是**解耦操作的发起者和执行者**。

### 核心概念

-   **`Command`**: 一个包含 `id`、`label`、`icon` 等元数据的简单对象，用于定义一个命令。
-   **`CommandHandler`**: 一个包含 `execute` 和可选的 `isEnabled`, `isVisible` 方法的对象，包含了命令的具体执行逻辑。
-   **`CommandRegistry`**: 命令注册表，是整个系统的中心。它维护一个从 `commandId`到 `CommandHandler` 列表的映射。
-   **`CommandContribution`**: 一个"贡献点"接口，采用了和插件系统类似的贡献者模式。其他模块可以实现这个接口，向 `CommandRegistry` 中注册自己的命令。

### 工作流程

1.  **注册**: 各个模块（通常是插件）通过实现 `CommandContribution` 接口，在 `registerCommands` 方法中调用 `commandRegistry.registerCommand(command, handler)` 来注册命令及其处理器。
2.  **执行**: 当需要执行一个命令时（例如，点击一个菜单项或按下快捷键），代码会调用 `commandRegistry.executeCommand(commandId, ...args)`。
3.  **分发**: `CommandRegistry` 找到对应的 `commandId`，然后从其 `CommandHandler` 列表中找到第一个 `isEnabled` 返回 `true` 的处理器，并调用其 `execute` 方法。

这套系统使得"删除节点"这个操作的发起者（比如快捷键插件、右键菜单、工具栏按钮）无需知道具体如何删除节点，它们只需要调用 `executeCommand('DELETE')` 即可。具体的删除逻辑则被封装在独立的 `CommandHandler` 中。

## 6.3 `History`: 独立的撤销/重做体系

`packages/common/history` 包负责实现撤销/重做功能。值得注意的是，**它并没有直接建立在 `Command` 系统之上**，而是一套独立的、更底层的体系。

### 核心概念

-   **`Operation`**: 这是历史记录的基本单元，代表一个可逆的状态变更。它是一个包含 `type` 和 `value` 的对象，并且必须在 `OperationRegistry` 中注册其元数据，包括如何 `apply`（应用）和 `invert`（反转）这个操作。
-   **`HistoryService`**: 历史记录的核心服务。它不直接记录 `Command`，而是记录 `Operation`。
-   **`UndoRedoService`**: `HistoryService` 内部使用的一个服务，它真正管理着 `undoStack` 和 `redoStack`。
-   **事务 (Transaction)**: `HistoryService` 支持事务。可以通过 `startTransaction()` 和 `endTransaction()` 将多个 `Operation` 组合成一个单一的撤销步骤。
-   **合并 (Merge)**: `Operation` 的元数据可以定义一个 `shouldMerge` 方法，允许将连续的、同类型的操作（例如，在输入框中连续输入文字）合并成一个历史记录项。

### 关系与区别

-   **`Command` vs `Operation`**: `Command` 是一个高层的、面向用户的"意图"（如"删除选中节点"），而 `Operation` 是一个底层的、可逆的"状态变更"（如"从文档中移除 ID 为 X 的节点"）。一个 `Command` 的 `execute` 方法可能会产生一个或多个 `Operation`。
-   **解耦**: 将历史记录系统与命令系统解耦是一个非常明智的设计。它意味着并非所有的 `Command` 都需要被记录到历史中（例如，UI的切换命令），也意味着某些非用户直接触发的状态变更也可以被纳入历史记录。

通过这三个系统的协同工作，`flowgram.ai` 构建了一个健壮、可扩展、易于维护的用户操作处理链路。
