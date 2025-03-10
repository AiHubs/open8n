import { mock } from 'jest-mock-extended';
import type { INode, WorkflowExecuteMode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { generateFailedExecutionFromError } from '@/workflow-helpers';

describe('generateFailedExecutionFromError', () => {
	const mode: WorkflowExecuteMode = 'manual';
	const node = mock<INode>({ name: 'Test Node' });
	const error = new NodeOperationError(node, 'Test error message');

	it('should generate a failed execution with error details', () => {
		const startTime = Date.now();

		const result = generateFailedExecutionFromError(mode, error, node, startTime);

		expect(result.mode).toBe(mode);
		expect(result.status).toBe('error');
		expect(result.startedAt).toBeInstanceOf(Date);
		expect(result.stoppedAt).toBeInstanceOf(Date);
		expect(result.data.resultData.error?.message).toEqual(error.message);

		const taskData = result.data.resultData.runData[node.name][0];
		expect(taskData.error?.message).toEqual(error.message);
		expect(taskData.startTime).toBe(startTime);
		expect(taskData.executionStatus).toBe('error');
		expect(result.data.resultData.lastNodeExecuted).toBe(node.name);
		expect(result.data.executionData?.nodeExecutionStack[0].node).toEqual(node);
	});

	it('should generate a failed execution without node details if node is undefined', () => {
		const result = generateFailedExecutionFromError(mode, error, undefined);

		expect(result.mode).toBe(mode);
		expect(result.status).toBe('error');
		expect(result.startedAt).toBeInstanceOf(Date);
		expect(result.stoppedAt).toBeInstanceOf(Date);
		expect(result.data.resultData.error?.message).toEqual(error.message);
		expect(result.data.resultData.runData).toEqual({});
		expect(result.data.resultData.lastNodeExecuted).toBeUndefined();
		expect(result.data.executionData).toBeUndefined();
	});
});
