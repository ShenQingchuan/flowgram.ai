# MVP 实现指南

本指南旨在指导完成一个具备核心渲染和交互能力的流程画布 MVP (最小可行产品)。

## 1. 代码风格规范

- **响应式状态**: 统一使用 `ref`。对于仅需要跟踪 `.value` 引用变更的对象/数组，可使用 `shallowRef` 作为性能优化。
- **模板引用**: 使用 Vue 最新的 `useTemplateRef('refName')` 方法，需要从 `vue` 中显式导入。<!-- [[memory:2203807]] -->

## 2. 数据结构定义 (`types.ts`)

```typescript
export interface Node {
  id: string;
  x: number; // 节点在世界坐标系中的 X 位置
  y: number; // 节点在世界坐标系中的 Y 位置
  // ... 其他自定义数据
}

export interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  // ... 其他自定义数据
}
```

## 3. 核心渲染机制

采用变换视口容器的方式来实现平移和缩放。节点本身只负责定义其在"世界坐标系"中的本地位置，所有变换都施加于父级的"视口"层。

- **优点**: 保证了完美的空间一致性。缩放时，所有元素（节点、连线、背景）等比例变化，符合直觉。
- **权衡**: 在 DOM 渲染方案下，高倍率放大可能导致内容（特别是文字）轻微模糊，这是为了获得正确空间感而接受的合理妥协。

## 4. 入口组件: `<FlowCanvas.vue>`

### 4.1 `<script setup>`: 完整逻辑

```vue
<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue'; // [[memory:2203807]]
import type { Node } from '../types';

// 1. Props
const props = defineProps<{
  nodes: Node[];
  // edges: Edge[]; // 备用
}>();

// 2. 核心状态：视口
const viewport = ref({
  x: 0, y: 0, scale: 1,
});

// 3. 模板引用
const canvasRef = useTemplateRef('canvasRef'); // [[memory:2203807]]
const viewportRef = useTemplateRef('viewportRef'); // [[memory:2203807]]

// 4. 计算属性
// 动态计算视口容器的 transform 样式
const viewportStyle = computed(() => {
  const { x, y, scale } = viewport.value;
  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    transformOrigin: '0 0',
  };
});

// 动态计算背景网格的样式
const canvasStyle = computed(() => {
  const { x, y, scale } = viewport.value;
  const gridSize = 20 * scale;
  return {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${x}px ${y}px`,
  };
});

// 为节点计算本地样式（仅含位置）
const getNodeStyle = (node: Node) => ({
  transform: `translate(${node.x}px, ${node.y}px)`,
});

// 5. 交互逻辑
// 5.1 拖拽平移
const panState = ref({
  isPanning: false, startX: 0, startY: 0, startViewportX: 0, startViewportY: 0,
});

const onPanStart = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const isPanTarget = target === canvasRef.value || target === viewportRef.value;
  if (event.button !== 0 || !isPanTarget) return;

  panState.value.isPanning = true;
  panState.value.startX = event.clientX;
  panState.value.startY = event.clientY;
  panState.value.startViewportX = viewport.value.x;
  panState.value.startViewportY = viewport.value.y;

  window.addEventListener('mousemove', onPanMove);
  window.addEventListener('mouseup', onPanEnd);
};

const onPanMove = (event: MouseEvent) => {
  if (!panState.value.isPanning) return;
  const dx = event.clientX - panState.value.startX;
  const dy = event.clientY - panState.value.startY;
  viewport.value.x = panState.value.startViewportX + dx;
  viewport.value.y = panState.value.startViewportY + dy;
};

const onPanEnd = () => {
  panState.value.isPanning = false;
  window.removeEventListener('mousemove', onPanMove);
  window.removeEventListener('mouseup', onPanEnd);
};

// 5.2 缩放与触控板平移
const handleWheel = (event: WheelEvent) => {
  event.preventDefault();

  if (event.ctrlKey) { // 捏合缩放或 Ctrl+滚轮
    const { x, y, scale } = viewport.value;
    const zoomSpeed = 0.005;
    const scaleDelta = -event.deltaY * zoomSpeed;
    const oldScale = scale;
    const newScale = Math.max(0.2, Math.min(4, oldScale + scaleDelta));

    if (newScale === oldScale) return;

    const mouseXWorld = (event.clientX - x) / oldScale;
    const mouseYWorld = (event.clientY - y) / oldScale;

    viewport.value.x = event.clientX - mouseXWorld * newScale;
    viewport.value.y = event.clientY - mouseYWorld * newScale;
    viewport.value.scale = newScale;
  } else { // 滚轮或双指平移
    viewport.value.x -= event.deltaX;
    viewport.value.y -= event.deltaY;
  }
};
</script>
```

### 4.2 `<template>`: 最终结构

```vue
<template>
  <div
    ref="canvasRef"
    class="flow-canvas"
    :style="canvasStyle"
    @wheel="handleWheel"
    @mousedown="onPanStart"
  >
    <div ref="viewportRef" class="flow-canvas__viewport" :style="viewportStyle">
      <!-- 节点渲染 -->
      <div
        v-for="node in props.nodes"
        :key="node.id"
        class="flow-canvas__node"
        :style="getNodeStyle(node)"
      >
        <slot name="node" :node="node">
          <div class="flow-canvas__node-default">
            {{ node.id }}
          </div>
        </slot>
      </div>

      <!-- Edge 渲染区域 (后续实现) -->
    </div>
  </div>
</template>
```

### 4.3 样式 (`FlowCanvas.css`)

```css
.flow-canvas {
  --node-bg: #ffffff;
  --node-color: #2c3e50;
  --node-border: #cccccc;
  --node-border-radius: 4px;
  --node-box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  cursor: grab;
  background-image: radial-gradient(#dcdcdc 1px, transparent 0);
  background-color: #f8f8f8;
}

.flow-canvas:active {
  cursor: grabbing;
}

.flow-canvas__viewport {
  width: 100%;
  height: 100%;
  position: relative;
}

.flow-canvas__node {
  position: absolute;
  cursor: pointer;
  will-change: transform;
}

.flow-canvas__node-default {
  padding: 10px 15px;
  background-color: var(--node-bg);
  color: var(--node-color);
  border: 1px solid var(--node-border);
  border-radius: var(--node-border-radius);
  box-shadow: var(--node-box-shadow);
  white-space: nowrap;
}
```
