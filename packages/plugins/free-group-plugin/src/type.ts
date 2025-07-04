/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC } from 'react';

import { WorkflowNodeEntity, WorkflowNodeJSON } from '@flowgram.ai/free-layout-core';

export interface WorkflowGroupPluginOptions {
  groupNodeRender: FC;
  disableGroupShortcuts?: boolean;
  disableGroupNodeRegister?: boolean;
  initGroupJSON?: (json: WorkflowNodeJSON, nodes: WorkflowNodeEntity[]) => WorkflowNodeJSON;
}

export const WorkflowGroupPluginOptions = Symbol('WorkflowGroupPluginOptions');
