import { NodeHelpers, Workflow } from 'n8n-workflow';
import { Service } from 'typedi';
import type express from 'express';

import * as WebhookHelpers from '@/webhooks/WebhookHelpers';
import { NodeTypes } from '@/NodeTypes';
import type {
	IWebhookResponseCallbackData,
	IWebhookManager,
	WaitingWebhookRequest,
} from './webhook.types';
import * as WorkflowExecuteAdditionalData from '@/WorkflowExecuteAdditionalData';
import { ExecutionRepository } from '@db/repositories/execution.repository';
import { Logger } from '@/Logger';
import { ConflictError } from '@/errors/response-errors/conflict.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';
import type { IExecutionResponse, IWorkflowDb } from '@/Interfaces';

/**
 * Service for handling the execution of webhooks of Wait nodes that use the
 * [Resume On Webhook Call](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/#on-webhook-call)
 * feature.
 */
@Service()
export class WaitingWebhooks implements IWebhookManager {
	protected includeForms = false;

	constructor(
		protected readonly logger: Logger,
		private readonly nodeTypes: NodeTypes,
		private readonly executionRepository: ExecutionRepository,
	) {}

	// TODO: implement `getWebhookMethods` for CORS support

	protected logReceivedWebhook(method: string, executionId: string) {
		this.logger.debug(`Received waiting-webhook "${method}" for execution "${executionId}"`);
	}

	protected disableNode(execution: IExecutionResponse, _method?: string) {
		execution.data.executionData!.nodeExecutionStack[0].node.disabled = true;
	}

	async executeWebhook(
		req: WaitingWebhookRequest,
		res: express.Response,
	): Promise<IWebhookResponseCallbackData> {
		const { path: executionId, suffix } = req.params;

		this.logReceivedWebhook(req.method, executionId);

		// Reset request parameters
		req.params = {} as WaitingWebhookRequest['params'];

		const execution = await this.executionRepository.findSingleExecution(executionId, {
			includeData: true,
			unflattenData: true,
		});

		if (!execution) {
			throw new NotFoundError(`The execution "${executionId} does not exist.`);
		}

		if (execution.status === 'running') {
			if (this.includeForms) {
				res.send(`
					<script>
						setTimeout(function() {
							window.location.reload();
						}, 1);
					</script>
				`);
				return {
					noWebhookResponse: true,
				};
			}
			throw new ConflictError(`The execution "${executionId} is running already.`);
		}

		if (execution.data.resultData.error) {
			throw new ConflictError(`The execution "${executionId} has finished with error.`);
		}

		let completionPage;
		if (execution.finished) {
			const { workflowData } = execution;
			const workflow = new Workflow({
				id: workflowData.id,
				name: workflowData.name,
				nodes: workflowData.nodes,
				connections: workflowData.connections,
				active: workflowData.active,
				nodeTypes: this.nodeTypes,
				staticData: workflowData.staticData,
				settings: workflowData.settings,
			});

			const connectedNodes = workflow.getParentNodes(
				execution.data.resultData.lastNodeExecuted as string,
			);

			completionPage = Object.keys(workflow.nodes).find((nodeName) => {
				const node = workflow.nodes[nodeName];
				return (
					connectedNodes.includes(nodeName) &&
					node.type === 'n8n-nodes-base.form' &&
					node.parameters.operation === 'completion'
				);
			});

			if (!completionPage) {
				throw new ConflictError(`The execution "${executionId} has finished already.`);
			}
		}

		const lastNodeExecuted =
			completionPage || (execution.data.resultData.lastNodeExecuted as string);

		// Set the node as disabled so that the data does not get executed again as it would result
		// in starting the wait all over again
		this.disableNode(execution, req.method);

		// Remove waitTill information else the execution would stop
		execution.data.waitTill = undefined;

		// Remove the data of the node execution again else it will display the node as executed twice
		execution.data.resultData.runData[lastNodeExecuted].pop();

		const { workflowData } = execution;

		const workflow = new Workflow({
			id: workflowData.id,
			name: workflowData.name,
			nodes: workflowData.nodes,
			connections: workflowData.connections,
			active: workflowData.active,
			nodeTypes: this.nodeTypes,
			staticData: workflowData.staticData,
			settings: workflowData.settings,
		});

		const workflowStartNode = workflow.getNode(lastNodeExecuted);
		if (workflowStartNode === null) {
			throw new NotFoundError('Could not find node to process webhook.');
		}

		const additionalData = await WorkflowExecuteAdditionalData.getBase();
		const webhookData = NodeHelpers.getNodeWebhooks(
			workflow,
			workflowStartNode,
			additionalData,
		).find(
			(webhook) =>
				webhook.httpMethod === req.method &&
				webhook.path === (suffix ?? '') &&
				webhook.webhookDescription.restartWebhook === true &&
				(webhook.webhookDescription.isForm || false) === this.includeForms,
		);

		if (webhookData === undefined) {
			// If no data got found it means that the execution can not be started via a webhook.
			// Return 404 because we do not want to give any data if the execution exists or not.
			const errorMessage = `The workflow for execution "${executionId}" does not contain a waiting webhook with a matching path/method.`;
			throw new NotFoundError(errorMessage);
		}

		const runExecutionData = execution.data;

		return await new Promise((resolve, reject) => {
			const executionMode = 'webhook';
			void WebhookHelpers.executeWebhook(
				workflow,
				webhookData,
				workflowData as IWorkflowDb,
				workflowStartNode,
				executionMode,
				undefined,
				runExecutionData,
				execution.id,
				req,
				res,

				(error: Error | null, data: object) => {
					if (error !== null) {
						return reject(error);
					}
					resolve(data);
				},
			);
		});
	}
}
