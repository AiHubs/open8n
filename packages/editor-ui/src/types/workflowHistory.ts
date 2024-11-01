import type { IConnections } from 'n8n-workflow';
import type { INodeUi } from '@/Interface';

export type WorkflowHistory = {
	versionId: string;
	authors: string;
	createdAt: string;
	updatedAt: string;
};

export type WorkflowVersionId = WorkflowHistory['versionId'];

export type WorkflowVersion = WorkflowHistory & {
	workflowId: string;
	nodes: INodeUi[];
	connections: IConnections;
};

export type WorkflowHistoryActionType =
	| 'restore'
	| 'clone'
	| 'open'
	| 'download'
	| 'showdiff'
	| 'closediff';

export type WorkflowHistoryRequestParams = { take: number; skip?: number };
