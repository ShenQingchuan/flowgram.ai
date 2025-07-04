# 8. 连线 (Edge) 渲染机制

在 `flowgram.ai` 中，连线的渲染是一个与节点布局和注册表系统深度绑定的过程。它并非简单地遍历 `edges` 数据并画线，而是由每个节点根据自身的类型和状态，动态地"声明"自己需要画出哪些连线。

## 8.1 核心概念: `getLines`

连线渲染的核心入口点是节点注册表 (`FlowNodeRegistry`) 中的 `getLines` 方法。

```typescript
// packages/canvas-engine/document/src/typings/flow-node-register.ts
export interface FlowNodeRegistry {
  // ... 其他属性
  getLines?: (transition: FlowNodeTransitionData) => FlowTransitionLine[];
}
```
- **职责归属**: 连线的计算逻辑被分配到了各个节点的 `Registry` 中。这意味着不同类型的节点（如 `if` 节点、`loop` 节点）可以拥有完全不同的连线逻辑和外观。
- **动态生成**: 渲染引擎在遍历节点树进行渲染时，会调用每个节点的 `getLines` 方法，收集所有返回的 `FlowTransitionLine` 对象，然后统一进行绘制。

## 8.2 `FlowTransitionLine`: 连线的数据结构

`getLines` 方法返回一个 `FlowTransitionLine` 数组。这个对象是连线的完整数据描述。

```typescript
// packages/canvas-engine/document/src/typings/flow-transition.ts
export interface FlowTransitionLine {
  type: FlowTransitionLineEnum; // 线的类型
  from: Point;                  // 起点坐标
  to: Point;                    // 终点坐标
  vertices?: Point[];           // 定义路径的"拐点"
  arrow?: boolean;              // 是否需要箭头
  // ... 其他属性
}
```

- **`type`**: `FlowTransitionLineEnum` 枚举了多种线条类型，如 `STRAIGHT_LINE` (直线), `ROUNDED_LINE` (圆角折线), `DIVERGE_LINE` (发散线), `MERGE_LINE` (合并线)。渲染器会根据这个类型来决定使用哪种绘制策略。
- **`vertices`**: 这是实现复杂路径（特别是曲线）的关键。它是一个坐标点数组，用于定义折线的中间"拐点"。例如，要画一条从 A 到 B，但在 C 点拐弯的线，`vertices` 就是 `[C]`。
- **坐标来源**: `getLines` 方法接收一个 `transition` 对象，可以从 `transition.transform` 中获取到当前节点、父节点、子节点等已经由布局系统计算好的精确坐标和边界信息（`inputPoint`, `outputPoint`, `bounds`），这些坐标被用来计算 `from`, `to`, 和 `vertices`。

## 8.3 案例分析: `loop-inline-blocks.ts` 的回环线

在 `packages/canvas-engine/fixed-layout-core/src/activities/loop-extends/loop-inline-blocks.ts` 中，我们可以看到一个非常典型的复杂连线计算的例子。

它为了画出一条从循环体末端"绕回"循环体前端的回环线，返回了两个 `ROUNDED_LINE` 类型的连线：

```typescript
// ...
// 循环回撤线 - 1
{
  type: FlowTransitionLineEnum.ROUNDED_LINE,
  from: currentTransform.outputPoint, // 从循环体末端出点
  to: leftBlockTransform.outputPoint,
  vertices: [
    // 定义了一个在 Y 轴上向下延伸，在 X 轴上对齐的拐点
    { x: leftBlockTransform.inputPoint.x, y: currentTransform.bounds.bottom }
  ],
},
// 循环回撤线 - 2
{
  type: FlowTransitionLineEnum.ROUNDED_LINE,
  from: leftBlockTransform.outputPoint,
  to: Point.move(currentTransform.inputPoint, { x: -12, y: 10 }), // 到达循环体前端入点附近
  vertices: [
    // 定义了一个在 Y 轴上向上延伸，在 X 轴上对齐的拐点
    { x: leftBlockTransform.inputPoint.x, y: currentTransform.bounds.top + 10 }
  ],
  arrow: true, // 并带上箭头
},
//...
```

这两段路径组合起来，就形成了一条视觉上平滑的回环曲线。底层的渲染器会负责将这些带 `vertices` 的 `ROUNDED_LINE` 转换成带圆角的 SVG 路径。

## 8.4 总结

`flowgram.ai` 的连线渲染是一个**声明式**、**节点驱动**的系统。
- **解耦**: 渲染引擎本身不知道如何计算路径，它只负责根据 `FlowTransitionLine` 对象来"画"线。所有的计算逻辑都被下放到了各个节点的注册信息中。
- **灵活**: 这种模式提供了极高的灵活性。开发者可以通过定义新的 `FlowNodeRegistry`，重写 `getLines` 方法，为新节点类型定制出任意复杂的连线行为和外观，而无需改动核心渲染器。

对于我们的 Vue 重写项目，虽然我们不必完全照搬这个基于 `Registry` 的复杂系统，但其核心思想值得借鉴：**将路径计算的逻辑封装成一个独立的函数，这个函数根据节点的位置和类型信息，生成一个描述路径的数据对象，然后由一个专门的组件根据这个数据对象来渲染 SVG**。
