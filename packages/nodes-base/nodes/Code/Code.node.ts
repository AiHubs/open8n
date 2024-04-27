import type {
	CodeExecutionMode,
	CodeNodeEditorLanguage,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import set from 'lodash/set';
import { javascriptCodeDescription } from './descriptions/JavascriptCodeDescription';
import { pythonCodeDescription } from './descriptions/PythonCodeDescription';
import { JavaScriptSandbox } from './JavaScriptSandbox';
import { PythonSandbox } from './PythonSandbox';
import { getSandboxContext } from './Sandbox';
import { standardizeOutput } from './utils';

const { CODE_ENABLE_STDOUT } = process.env;

export class Code implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Code',
		name: 'code',
		icon: 'file:code.svg',
		group: ['transform'],
		version: [1, 2],
		defaultVersion: 2,
		description: 'Run custom JavaScript or Python code',
		defaults: {
			name: 'Code',
		},
		inputs: ['main'],
		outputs: ['main'],
		parameterPane: 'wide',
		properties: [
			{
				displayName: 'Map Output Items to Input Items',
				name: 'mapOutput',
				type: 'boolean',
				default: false,
				isNodeSetting: true,
				displayOptions: {
					show: {
						mode: ['runOnceForAllItems'],
					},
				},
			},
			{
				displayName: 'Maping Type',
				name: 'mapingType',
				type: 'options',
				isNodeSetting: true,
				displayOptions: {
					show: {
						mode: ['runOnceForAllItems'],
						mapOutput: [true],
					},
				},
				options: [
					{
						name: 'Map by Index',
						value: 'byIndex',
						description: 'Each output item will be mapped to the input item with the same index',
					},
					{
						name: 'Map to First Item',
						value: 'toFirstItem',
						description: 'All output items will be mapped to the first input item',
					},
					{
						name: 'Map by Field',
						value: 'byField',
						description:
							'Each output item will be mapped to the input item with the same field(s) value',
					},
				],
				default: 'byIndex',
			},
			{
				displayName: 'Fields to Match',
				name: 'fieldsToMatch',
				type: 'fixedCollection',
				isNodeSetting: true,
				placeholder: 'Add Fields to Match',
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						displayName: 'Values',
						name: 'values',
						values: [
							{
								displayName: 'Input Item Field',
								name: 'inputItemField',
								type: 'string',
								default: '',
								requiresDataPath: 'single',
							},
							{
								displayName: 'Output Item Field',
								name: 'outputItemField',
								type: 'string',
								default: '',
								requiresDataPath: 'single',
							},
						],
					},
				],
				displayOptions: {
					show: {
						mode: ['runOnceForAllItems'],
						mapOutput: [true],
						mapingType: ['byField'],
					},
				},
			},
			{
				displayName: 'Fallback Index',
				name: 'fallbackIndex',
				type: 'number',
				isNodeSetting: true,
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				displayOptions: {
					show: {
						mode: ['runOnceForAllItems'],
						mapOutput: [true],
						mapingType: ['byField', 'byIndex'],
					},
				},
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run Once for All Items',
						value: 'runOnceForAllItems',
						description: 'Run this code only once, no matter how many input items there are',
					},
					{
						name: 'Run Once for Each Item',
						value: 'runOnceForEachItem',
						description: 'Run this code as many times as there are input items',
					},
				],
				default: 'runOnceForAllItems',
			},
			{
				displayName:
					"Consider specifying the mapping of output items to input items in this node's settings (cog icon). This allows you to use the <pre>$('Node Name').item</pre> syntax in further nodes expressions and helps prevent errors related to <strong>pairedItems</strong>.",
				name: 'mapOutputWarning',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						mode: ['runOnceForAllItems'],
						mapOutput: [false],
					},
				},
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						'@version': [2],
					},
				},
				options: [
					{
						name: 'JavaScript',
						value: 'javaScript',
					},
					{
						name: 'Python (Beta)',
						value: 'python',
					},
				],
				default: 'javaScript',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'hidden',
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
				default: 'javaScript',
			},

			...javascriptCodeDescription,
			...pythonCodeDescription,
		],
	};

	async execute(this: IExecuteFunctions) {
		const nodeMode = this.getNodeParameter('mode', 0) as CodeExecutionMode;
		const workflowMode = this.getMode();

		const node = this.getNode();
		const language: CodeNodeEditorLanguage =
			node.typeVersion === 2
				? (this.getNodeParameter('language', 0) as CodeNodeEditorLanguage)
				: 'javaScript';
		const codeParameterName = language === 'python' ? 'pythonCode' : 'jsCode';

		let InputLength = 0;

		const getSandbox = (index = 0) => {
			const code = this.getNodeParameter(codeParameterName, index) as string;
			const context = getSandboxContext.call(this, index);
			if (nodeMode === 'runOnceForAllItems') {
				context.items = context.$input.all();
				InputLength = context.items.length;
			} else {
				context.item = context.$input.item;
			}

			const Sandbox = language === 'python' ? PythonSandbox : JavaScriptSandbox;
			const sandbox = new Sandbox(context, code, index, this.helpers);
			sandbox.on(
				'output',
				workflowMode === 'manual'
					? this.sendMessageToUI
					: CODE_ENABLE_STDOUT === 'true'
						? (...args) =>
								console.log(`[Workflow "${this.getWorkflow().id}"][Node "${node.name}"]`, ...args)
						: () => {},
			);
			return sandbox;
		};

		// ----------------------------------
		//        runOnceForAllItems
		// ----------------------------------

		if (nodeMode === 'runOnceForAllItems') {
			const sandbox = getSandbox();
			let items: INodeExecutionData[];
			try {
				items = (await sandbox.runCodeAllItems()) as INodeExecutionData[];
			} catch (error) {
				if (!this.continueOnFail()) {
					set(error, 'node', node);
					throw error;
				}
				items = [{ json: { error: error.message } }];
			}

			for (const item of items) {
				standardizeOutput(item.json);
			}

			const mapOutput = this.getNodeParameter('mapOutput', 0, false) as boolean;

			if (mapOutput) {
				const mapingType = this.getNodeParameter('mapingType', 0, 'byIndex') as string;
				let fallbackIndex = 0;

				switch (mapingType) {
					case 'byIndex':
						fallbackIndex = this.getNodeParameter('fallbackIndex', 0, 0) as number;
						items.map((item, index) => {
							item.pairedItem = { item: index < InputLength ? index : fallbackIndex };
							return item;
						});
						break;
					case 'toFirstItem':
						items.map((item) => {
							item.pairedItem = { item: 0 };
							return item;
						});
						break;
					case 'byField':
						const fieldsToMatch = this.getNodeParameter('fieldsToMatch.values', 0, []) as Array<{
							inputItemField: string;
							outputItemField: string;
						}>;
						fallbackIndex = this.getNodeParameter('fallbackIndex', 0, 0) as number;
						const inputItems = this.getInputData();

						items.map((item) => {
							let index = inputItems.findIndex((inputItem) => {
								for (const field of fieldsToMatch) {
									if (inputItem.json[field.inputItemField] !== item.json[field.outputItemField]) {
										return false;
									}
								}
								return true;
							});
							if (index === -1) {
								index = fallbackIndex;
							}
							item.pairedItem = { item: index };
							return item;
						});
						break;
				}

				return [items];
			} else {
				return [items];
			}
		}

		// ----------------------------------
		//        runOnceForEachItem
		// ----------------------------------

		const returnData: INodeExecutionData[] = [];

		const items = this.getInputData();

		for (let index = 0; index < items.length; index++) {
			const sandbox = getSandbox(index);
			let result: INodeExecutionData | undefined;
			try {
				result = await sandbox.runCodeEachItem();
			} catch (error) {
				if (!this.continueOnFail()) {
					set(error, 'node', node);
					throw error;
				}
				returnData.push({
					json: { error: error.message },
					pairedItem: {
						item: index,
					},
				});
			}

			if (result) {
				returnData.push({
					json: standardizeOutput(result.json),
					pairedItem: { item: index },
					...(result.binary && { binary: result.binary }),
				});
			}
		}

		return [returnData];
	}
}
