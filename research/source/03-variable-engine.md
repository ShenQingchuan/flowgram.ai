# 3. 变量引擎解析

流程编排中的一个核心问题是如何管理和传递数据。在 Flowgram.ai中，这个职责由一个独立且强大的**变量引擎** (`packages/variable-engine`) 来承担。本章将深入解析其设计与实现。

## 3.1 核心概念: Engine, Scope, and Chain

变量引擎的基石是三个核心概念：`VariableEngine` (引擎)、`Scope` (作用域) 和 `ScopeChain` (作用域链)。

### 1. `VariableEngine`: 全局管理器

`VariableEngine` (`packages/variable-engine/variable-core/src/variable-engine.ts`) 是一个单例服务，作为整个变量系统的入口和管理器。它的主要职责是：

-   **创建和销毁作用域 (`Scope`)**: 提供了 `createScope()` 和 `removeScopeById()` 方法来管理作用域的生命周期。
-   **维护全局变量表**: 持有一个 `globalVariableTable`，用于存储全局范围的变量。
-   **事件中心**: 内部有一个 `rxjs` 的 `Subject` (`globalEvent$`) 和一个 `Emitter` (`onScopeChangeEmitter`)，负责向外广播作用域和变量的变化事件。

### 2. `Scope`: 变量的容器

`Scope` (`packages/variable-engine/variable-core/src/scope/scope.ts`) 是变量存储和计算的基本单元。每个 `Scope` 实例可以看作是一个独立的变量容器。

-   **与节点的对应关系**: 在流程图中，通常每个节点 (`FlowNodeEntity`) 都会通过 `FlowNodeVariableData` 这个数据扩展，拥有至少一个与之关联的 `Scope` 实例（通常是一个 public scope，有时还有一个 private scope）。这意味着每个节点都有自己独立的变量作用域。
-   **内部数据**:
    -   `output`: 存储该作用域自身"生产"的变量。
    -   `available`: 一个非常重要的数据对象，它**计算并缓存了**从当前作用域可以访问到的**所有**变量（包括自身产生的、父级作用域传入的、以及全局的）。UI组件（如变量选择器）通常就是监听这个 `available` 对象的变化来刷新视图。
-   **AST**: 每个 `Scope` 内部都维护一个AST（抽象语法树）来表示其定义的变量和表达式，我们将在下一节详述。

### 3. `ScopeChain`: 决定变量可见性

`ScopeChain` (`packages/variable-engine/variable-core/src/scope/scope-chain.ts`) 定义了作用域之间的父子和依赖关系。它是一个偏序集合，决定了在一个作用域内部，能够"看到"哪些其他作用域的变量。

-   **布局相关**: `ScopeChain` 的具体实现是与布局模式相关的。例如，`FixedLayoutScopeChain` 和 `FreeLayoutScopeChain` 会根据各自布局的特点（如节点的父子关系、连线关系）来计算作用域之间的依赖。
-   **计算可用变量**: 当某个 `Scope` 的 `available` 数据需要更新时，它会向 `ScopeChain` 查询其所有的依赖作用域 (`depScopes`)，然后将这些依赖作用域的 `output` 变量和自身的 `output` 变量合并，形成最终的可用变量列表。

这三个概念协同工作，构建了一个强大而灵活的变量管理系统：`VariableEngine` 作为全局管理者，`Scope` 作为独立的变量容器，`ScopeChain` 则像一张地图，指引着变量的查找和流动路径。

## 3.2 AST: 变量的数据模型

变量引擎没有使用简单的 JavaScript `Object` 来存储变量，而是采用了一套完整的**抽象语法树（Abstract Syntax Tree, AST）**体系来描述变量、类型和表达式。这套体系位于 `packages/variable-engine/variable-core/src/ast/` 目录下。

### 为什么使用 AST？

使用 AST 带来了几个核心优势：

1.  **富类型系统**: AST 允许定义一个比原生 JSON 更丰富的类型系统。除了 `String`, `Number`, `Object` 等基础类型，还可以定义如 `Union` (联合类型), `CustomType` (自定义类型) 等复杂类型，为静态检查和智能提示提供了基础。
2.  **响应式与可计算**: AST 中的每个节点 (`ASTNode`) 都是一个可响应的对象。当树中的某个节点发生变化时，可以精确地通知到依赖它的其他部分，实现高效的增量计算。例如，一个节点的输出变量可以是一个表达式，当表达式的输入变化时，可以自动重新计算其值。
3.  **结构化与校验**: AST 提供了一套严格的结构来定义变量。例如，`VariableDeclaration` (变量声明) 节点必须包含 `key` (变量名) 和 `type` (类型) 等信息。这种结构化的数据使得校验和分析变得容易。
4.  **跨语言/平台潜力**: 一套定义良好的 AST 是语言无关的。理论上，这套变量模型可以被序列化成 JSON，然后在不同的语言环境（如后端
    Node.js）中解析和执行，实现前后端统一的逻辑处理。

### AST 节点类型

`Scope` 中的 `ast` 属性是一个 `ASTNode` 的实例，它作为根节点，其下可以挂载多种类型的子节点。主要的节点类型包括：

-   **声明节点 (`Declaration`)**:
    -   `VariableDeclaration`: 用于声明一个变量，包含 `key` (变量名) 和 `valueType` (变量类型)。
-   **类型节点 (`Type`)**:
    -   `StringType`, `NumberType`, `BooleanType`, `ObjectType`, `ArrayType` 等，描述了变量的具体类型。
    -   `ObjectType` 可以包含多个 `Property` 子节点，每个 `Property` 又有自己的 `key` 和 `valueType`，从而可以描述出复杂的嵌套对象结构。
-   **表达式节点 (`Expression`)**:
    -   虽然在当前代码中不明显，但这套 AST 体系为未来支持 `{{ a + b }}` 这样的表达式计算预留了能力。

通过 `ASTFactory` (`ast/factory.ts`) 这个工厂类，可以方便地用编程方式创建和组合这些 AST 节点，构建出复杂的变量结构。例如，一个节点的输出可以被定义为一个包含多个属性的 `ObjectType`，每个属性都有自己明确的类型。

这种基于 AST 的设计，是变量引擎强大能力的核心。它将简单的"数据存储"升级为了"可计算、可校验、响应式的逻辑描述"。

## 3.3 响应式系统与数据流

变量引擎的另一个核心特点是其**完全响应式**的架构。这意味着当任何数据发生变化时，所有依赖该数据的地方都会收到通知并自动更新。这是通过 `rxjs` 和一个自定义的 `Emitter` 类实现的。

### 事件驱动

-   **`VariableEngine` 的事件**: `VariableEngine` 本身就是一个事件中心。它提供 `onScopeChange` 事件，当作用域被创建、更新或删除时，会发出通知。插件和UI组件可以订阅这个事件来动态地响应作用域的变化。
-   **`Scope` 的内部事件**: 每个 `Scope` 对象内部也有自己的事件系统。例如，当 `Scope` 内的 `available` (可用变量列表) 发生变化时，会触发 `onDataChange` 事件。

### `ScopeAvailableData`：响应式计算的核心

`ScopeAvailableData` (`packages/variable-engine/variable-core/src/scope/datas/scope-available-data.ts`) 是理解响应式数据流的关键。

-   **监听依赖**: 一个 `Scope` 的 `available` 数据对象会监听其所有依赖作用域 (`depScopes`) 的 `output` 数据的变化事件。
-   **缓存与惰性计算**: `available` 对象内部使用了 `memo` (记忆化) 技术。它不会在每次依赖变化时都立即重新计算，而是在真正被访问时才根据 `dirty` 标记决定是否需要重新计算。
-   **触发更新**: 当它监听到任何一个依赖项发生变化后，它会将自己标记为"脏"(`dirty = true`)，然后触发自身的 `onDataChange` 事件。

### 数据流示例：变量选择器

我们可以通过一个典型的"变量选择器"UI组件的例子来梳理整个数据流：

1.  **初始化**:
    -   变量选择器组件被渲染时，它会从当前的 `Scope` 中获取 `available` 对象。
    -   它向 `available.onDataChange` 注册一个回调函数，该函数会触发组件的重新渲染（如 `setState`）。
    -   它首次调用 `available.getVariables()`，获取当前所有可用的变量，并渲染成一个列表。

2.  **上游节点发生变化**:
    -   用户修改了流程中某个上游节点A的输出变量。
    -   节点A对应的 `ScopeA` 的 `output` 数据发生变化，并发出通知。

3.  **数据更新传播**:
    -   依赖 `ScopeA` 的 `ScopeB`（即变量选择器所在的`Scope`）的 `available` 对象收到了来自 `ScopeA` 的变更通知。
    -   `ScopeB` 的 `available` 对象将自己标记为 `dirty`，并触发自己的 `onDataChange` 事件。

4.  **UI 自动刷新**:
    -   变量选择器组件注册的回调函数被触发。
    -   组件状态更新，触发重新渲染。在渲染函数中，它再次调用 `available.getVariables()`。
    -   由于 `available` 对象是 `dirty` 的，它会重新计算完整的可用变量列表（合并所有依赖的 `output`）。
    -   组件获取到最新的变量列表，并渲染出更新后的UI。

整个过程是完全自动和数据驱动的。UI组件和下层作用域无需关心上游发生了什么，它们只需"订阅"自己所依赖的数据，当数据变化时，它们会自动收到通知并进行更新。这种设计极大地简化了复杂状态下的UI开发。

## 3.4 与编辑器的集成

变量引擎作为一个独立的包，需要一套机制来与上层的编辑器（Editor）和节点引擎（Node Engine）集成。这是通过 `inversify` 依赖注入和几个关键的插件来完成的。

### 1. `VariableContainerModule`: 注册服务

`VariableContainerModule` (`packages/variable-engine/variable-core/src/variable-container-module.ts`) 是一个 `inversify` 的 `ContainerModule`。它的作用是在依赖注入容器中注册变量引擎相关的核心服务。

-   `bind(VariableEngine).toSelf().inSingletonScope()`: 这行代码将 `VariableEngine` 类自身绑定到容器，并设置为单例模式。这意味着在整个应用生命周期中，只有一个 `VariableEngine` 实例。

当 `createDefaultPreset` 被调用时，这个模块会被加载到主 DI 容器中，从而使得应用中的任何部分都可以通过 `@inject(VariableEngine)` 来获取到变量引擎的实例。

### 2. `createVariablePlugin`: 启用引擎

`createVariablePlugin` (`packages/plugins/variable-plugin`) 是一个编辑器插件。在 `createDefaultPreset` 中，它会根据 `opts.variableEngine.enable` 的配置来决定是否加载。

这个插件的主要职责是创建和绑定特定布局的 `ScopeChain` 实现（如 `FixedLayoutScopeChain` 或 `FreeLayoutScopeChain`）到 DI 容器中，并初始化一些与布局相关的服务。

### 3. `FlowNodeVariableData`: 将变量能力附加到节点

这是最关键的集成点。`FlowNodeVariableData` (`packages/variable-engine/variable-layout/src/flow-node-variable-data.ts`) 是一个 `EntityData` 的子类。在 `canvas-engine` 中，`Entity` (如 `FlowNodeEntity`) 可以附加任意的 `EntityData` 来扩展其能力。

-   **注册**: 在 `variable-plugin` 或相关的测试设置中，通过 `entityManager.registerEntityData()` 将 `FlowNodeVariableData` 注册到系统中。
-   **附加**: 当一个新的 `FlowNodeEntity` 被创建时，`EntityManager` 会自动为其创建一个 `FlowNodeVariableData` 实例。
-   **创建作用域**: 在 `FlowNodeVariableData` 的构造函数中，它会调用 `variableEngine.createScope()`，为当前节点创建一个 `Scope`。

通过这种方式，每个节点实体 (`FlowNodeEntity`) 都被无缝地赋予了变量管理的能力。当我们需要操作某个节点的变量时，只需从该节点实例上获取其 `FlowNodeVariableData`，然后就可以访问其 `public` 或 `private` 作用域了。

### 4. `createNodeVariablePlugin`: 集成节点表单

`createNodeVariablePlugin` (`packages/plugins/node-variable-plugin`) 插件则更进一步，它负责将变量引擎与节点属性的**表单**系统连接起来。当用户在节点的设置面板中修改一个属性时，如果这个属性的值是一个变量引用，这个插件就会确保相关的数据得到正确的更新和校验。

通过这几个层次的集成，变量引擎被优雅地融入了整个编辑器架构中，既保持了自身的独立和内聚，又与上层应用实现了高效的协同工作。
