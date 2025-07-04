# Flowgram.ai 源码学习

本项目旨在深入研究 `flowgram.ai` 仓库，为使用 Vue 重写一个类似的流程编排库提供理论和实践依据。

## 研究计划

1.  [x] **项目整体架构分析**
    -   `monorepo` 结构解析
    -   核心 `packages` 职责划分
    -   `apps` 示例项目的作用
2.  [x] **画布核心实现**
    -   渲染引擎 `canvas-engine`
    -   数据模型 (`document`, `node`)
    -   布局模式 (`fixed-layout` vs `free-layout`)
    -   交互实现（拖拽、连线、缩放、选中）
3.  [x] **变量引擎**
    -   变量的核心概念与模型
    -   变量的生命周期与作用域
    -   表达式计算与依赖更新
4.  [x] **源码优缺点分析**
5.  [ ] **插件化架构**
6.  [ ] **状态管理与命令系统**
7.  [ ] **物料系统**

## 研究成果

-   [01 - 项目整体架构分析](./01-architecture-overview.md)
-   [02 - 画布核心实现](./02-canvas-implementation.md)
-   [03 - 变量引擎](./03-variable-engine.md)
-   [04 - 源码优缺点分析](./04-strengths-and-weaknesses.md)
