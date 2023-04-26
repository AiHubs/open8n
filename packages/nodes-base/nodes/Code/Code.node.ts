import type {
	EditorLanguageTypes,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { getSandboxContext, SandboxJavaScript } from './SandboxJavaScript';
import { getSandboxContextPython, SandboxPython } from './SandboxPython';
import { standardizeOutput } from './utils';
import type { CodeNodeMode } from './utils';

// TODO: Find better way to suppress warnings

// eslint-disable-next-line @typescript-eslint/no-var-requires
globalThis.Blob = require('node:buffer').Blob;
// From: https://github.com/nodejs/node/issues/30810
const { emitWarning } = process;
process.emitWarning = (warning, ...args) => {
	if (args[0] === 'ExperimentalWarning') {
		return;
	}
	if (args[0] && typeof args[0] === 'object' && args[0].type === 'ExperimentalWarning') {
		return;
	}
	return emitWarning(warning, ...(args as string[]));
};

export class Code implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Code',
		name: 'code',
		icon: 'fa:code',
		group: ['transform'],
		version: [1, 2],
		defaultVersion: 1,
		description: 'Run custom JavaScript code',
		defaults: {
			name: 'Code',
			color: '#FF9922',
		},
		inputs: ['main'],
		outputs: ['main'],
		parameterPane: 'wide',
		properties: [
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

			// JavaScript
			{
				displayName: 'JavaScript',
				name: 'jsCode',
				typeOptions: {
					editor: 'codeNodeEditor',
					editorLanguage: 'javaScript',
				},
				displayOptions: {
					show: {
						'@version': [1],
						mode: ['runOnceForAllItems'],
					},
				},
				type: 'string',
				default: `
// Loop over input items and add a new field
// called 'myNewField' to the JSON of each one
for (const item of $input.all()) {
  item.json.myNewField = 1;
}

return $input.all();
				`.trim(),
				description:
					'JavaScript code to execute.<br><br>Tip: You can use luxon vars like <code>$today</code> for dates and <code>$jmespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
				noDataExpression: true,
			},
			{
				displayName: 'JavaScript',
				name: 'jsCode',
				typeOptions: {
					editor: 'codeNodeEditor',
					editorLanguage: 'javaScript',
				},
				displayOptions: {
					show: {
						'@version': [1],
						mode: ['runOnceForEachItem'],
					},
				},
				type: 'string',
				default: `
// Add a new field called 'myNewField' to the
// JSON of the item
$input.item.json.myNewField = 1;

return $input.item;
				`.trim(),
				description:
					'JavaScript code to execute.<br><br>Tip: You can use luxon vars like <code>$today</code> for dates and <code>$jmespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
				noDataExpression: true,
			},
			{
				displayName: 'JavaScript',
				name: 'jsCode',
				typeOptions: {
					editor: 'codeNodeEditor',
					editorLanguage: 'javaScript',
				},
				displayOptions: {
					show: {
						'@version': [2],
						language: ['javaScript'],
						mode: ['runOnceForAllItems'],
					},
				},
				type: 'string',
				default: `
// Loop over input items and add a new field
// called 'myNewField' to the JSON of each one
for (const item of $input.all()) {
  item.json.myNewField = 1;
}

return $input.all();
				`.trim(),
				description:
					'JavaScript code to execute.<br><br>Tip: You can use luxon vars like <code>$today</code> for dates and <code>$jmespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
				noDataExpression: true,
			},
			{
				displayName: 'JavaScript',
				name: 'jsCode',
				typeOptions: {
					editor: 'codeNodeEditor',
					editorLanguage: 'javaScript',
				},
				displayOptions: {
					show: {
						language: ['javaScript'],
						mode: ['runOnceForEachItem'],
					},
				},
				type: 'string',
				default: `
// Add a new field called 'myNewField' to the
// JSON of the item
$input.item.json.myNewField = 1;

return $input.item;
				`.trim(),
				description:
					'JavaScript code to execute.<br><br>Tip: You can use luxon vars like <code>$today</code> for dates and <code>$jmespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
				noDataExpression: true,
			},
			{
				displayName:
					'Type <code>$</code> for a list of <a target="_blank" href="https://docs.n8n.io/code-examples/methods-variables-reference/">special vars/methods</a>. Debug by using <code>console.log()</code> statements and viewing their output in the browser console.',
				name: 'notice',
				type: 'notice',
				displayOptions: {
					show: {
						language: ['javaScript'],
					},
				},
				default: '',
			},

			// Python
			{
				displayName: 'Python',
				name: 'pythonCode',
				typeOptions: {
					editor: 'codeNodeEditor',
					editorLanguage: 'python',
				},
				displayOptions: {
					show: {
						language: ['python'],
						mode: ['runOnceForAllItems'],
					},
				},
				type: 'string',
				default: `
# Loop over input items and add a new field
# called 'myNewField' to the JSON of each one
for item in _input.all():
  item.json.myNewField = 1;

return _input.all();
				`.trim(),
				description:
					'Python code to execute.<br><br>Tip: You can use luxon vars like <code>_today</code> for dates and <code>$_mespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
				noDataExpression: true,
			},
			{
				displayName: 'Python',
				name: 'pythonCode',
				typeOptions: {
					editor: 'codeNodeEditor',
					editorLanguage: 'python',
				},
				displayOptions: {
					show: {
						language: ['python'],
						mode: ['runOnceForEachItem'],
					},
				},
				type: 'string',
				default: `
# Add a new field called 'myNewField' to the
# JSON of the item
_input.item.json.myNewField = 1;

return _input.item;
				`.trim(),
				description:
					'Python code to execute.<br><br>Tip: You can use luxon vars like <code>_today</code> for dates and <code>$_mespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
				noDataExpression: true,
			},
			{
				displayName:
					'Debug by using <code>print()</code> statements and viewing their output in the browser console.',
				name: 'notice',
				type: 'notice',
				displayOptions: {
					show: {
						language: ['python'],
					},
				},
				default: '',
			},
			{
				displayName: 'Python Modules',
				name: 'modules',
				displayOptions: {
					show: {
						language: ['python'],
					},
				},
				type: 'string',
				default: '',
				placeholder: 'opencv-python',
				description:
					'Comma-separated list of Python modules to load. They have to be installed to be able to be loaded and imported.',
				noDataExpression: true,
			},
		],
	};

<<<<<<< HEAD
	async executePython(this: IExecuteFunctions) {
		let items = this.getInputData();

		const nodeMode = this.getNodeParameter('mode', 0) as CodeNodeMode;
		const workflowMode = this.getMode();
		const sandbox = new SandboxPython(nodeMode, this.helpers);

		// ----------------------------------
		//        runOnceForAllItems
		// ----------------------------------
		if (nodeMode === 'runOnceForAllItems') {
			const pythonCode = this.getNodeParameter('pythonCode', 0) as string;
			const modules = this.getNodeParameter('modules', 0) as string;
			const moduleImports = modules
				? modules.split(',').map((importModule) => importModule.trim())
				: [];

			const context = getSandboxContextPython.call(this, 0);

			if (workflowMode === 'manual') {
				context.printOverwrite = this.sendMessageToUI;
			} else {
				context.printOverwrite = null;
			}

			try {
				items = (await sandbox.runCode(context, pythonCode, moduleImports)) as INodeExecutionData[];
			} catch (error) {
				if (!this.continueOnFail()) {
					return Promise.reject(error);
				}
				items = [{ json: { error: error.message } }];
			}

			for (const item of items) {
				standardizeOutput(item.json);
			}

			return this.prepareOutputData(items);
		}
		// ----------------------------------
		//        runOnceForEachItem
		// ----------------------------------
		else {
			const returnData: INodeExecutionData[] = [];

			let item: INodeExecutionData | undefined;
			for (let index = 0; index < items.length; index++) {
				const pythonCode = this.getNodeParameter('pythonCode', index) as string;
				const modules = this.getNodeParameter('modules', index) as string;
				const moduleImports = modules
					? modules.split(',').map((importModule) => importModule.trim())
					: [];

				const context = getSandboxContextPython.call(this, index);

				if (workflowMode === 'manual') {
					context.printOverwrite = this.sendMessageToUI;
				} else {
					context.printOverwrite = null;
				}

				try {
					item = (await sandbox.runCode(
						context,
						pythonCode,
						moduleImports,
						index,
					)) as INodeExecutionData;
				} catch (error) {
					if (!this.continueOnFail()) {
						return Promise.reject(error);
					}
					returnData.push({ json: { error: error.message } });
					items = [{ json: { error: error.message } }];
				}

				if (item) {
					returnData.push({
						json: standardizeOutput(item.json),
						pairedItem: { item: index },
						...(item.binary && { binary: item.binary }),
					});
				}
			}

			return this.prepareOutputData(returnData);
		}
	}

	async executeJavascript(this: IExecuteFunctions) {
		let items = this.getInputData();

=======
	async execute(this: IExecuteFunctions) {
>>>>>>> origin/master
		const nodeMode = this.getNodeParameter('mode', 0) as CodeNodeMode;
		const workflowMode = this.getMode();

		// ----------------------------------
		//        runOnceForAllItems
		// ----------------------------------
		if (nodeMode === 'runOnceForAllItems') {
			const jsCodeAllItems = this.getNodeParameter('jsCode', 0) as string;

			const context = getSandboxContext.call(this, 0);
			context.items = context.$input.all();
<<<<<<< HEAD
			const sandbox = new SandboxJavaScript(context, workflowMode, nodeMode, this.helpers);
=======
			const sandbox = new Sandbox(context, jsCodeAllItems, workflowMode, this.helpers);
>>>>>>> origin/master

			if (workflowMode === 'manual') {
				sandbox.vm.on('console.log', this.sendMessageToUI);
			}

			let result: INodeExecutionData[];
			try {
				result = await sandbox.runCodeAllItems();
			} catch (error) {
				if (!this.continueOnFail()) throw error;
				result = [{ json: { error: error.message } }];
			}

			for (const item of result) {
				standardizeOutput(item.json);
			}

			return this.prepareOutputData(result);
		}
		// ----------------------------------
		//        runOnceForEachItem
		// ----------------------------------
		else {
			const returnData: INodeExecutionData[] = [];

			for (let index = 0; index < items.length; index++) {
				let item = items[index];

<<<<<<< HEAD
				const jsCodeEachItem = this.getNodeParameter('jsCode', index) as string;

				const context = getSandboxContext.call(this, index);
				context.item = context.$input.item;
				const sandbox = new SandboxJavaScript(context, workflowMode, nodeMode, this.helpers);

				if (workflowMode === 'manual') {
					sandbox.vm.on('console.log', this.sendMessageToUI);
				}
=======
		const items = this.getInputData();

		for (let index = 0; index < items.length; index++) {
			const jsCodeEachItem = this.getNodeParameter('jsCode', index) as string;

			const context = getSandboxContext.call(this, index);
			context.item = context.$input.item;
			const sandbox = new Sandbox(context, jsCodeEachItem, workflowMode, this.helpers);
>>>>>>> origin/master

				try {
					item = await sandbox.runCode(jsCodeEachItem, index);
				} catch (error) {
					if (!this.continueOnFail()) return Promise.reject(error);
					returnData.push({ json: { error: error.message } });
				}

				if (item) {
					returnData.push({
						json: standardizeOutput(item.json),
						pairedItem: { item: index },
						...(item.binary && { binary: item.binary }),
					});
				}
			}

<<<<<<< HEAD
			return this.prepareOutputData(returnData);
=======
			let result: INodeExecutionData | undefined;
			try {
				result = await sandbox.runCodeEachItem(index);
			} catch (error) {
				if (!this.continueOnFail()) throw error;
				returnData.push({ json: { error: error.message } });
			}

			if (result) {
				returnData.push({
					json: standardizeOutput(result.json),
					pairedItem: { item: index },
					...(result.binary && { binary: result.binary }),
				});
			}
>>>>>>> origin/master
		}
	}

	async execute(this: IExecuteFunctions) {
		let language: EditorLanguageTypes = 'javaScript';
		if (this.getNode().typeVersion === 2) {
			language = this.getNodeParameter('language', 0) as EditorLanguageTypes;
		}
		return Code.prototype[language === 'python' ? 'executePython' : 'executeJavascript'].call(this);
	}
}
