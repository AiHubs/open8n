import { IExecuteFunctions } from 'n8n-core';
import { IDataObject, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';

export class SplitInBatches implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Split In Batches',
		name: 'splitInBatches',
		icon: 'fa:th-large',
		group: ['organization'],
		version: 1,
		description: 'Split data into batches and iterate over each batch',
		defaults: {
			name: 'SplitInBatches',
			color: '#007755',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName:
					'You may not need this node — n8n nodes automatically run once for each input item. <a href="https://docs.n8n.io/getting-started/key-concepts/looping.html#using-loops-in-n8n" target="_blank">More info</a>',
				name: 'splitInBatchesNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 10,
				description: 'The number of items to return with each call',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Reset',
						name: 'reset',
						type: 'boolean',
						default: false,
						description:
							'If set to true, the node will be reset and so with the current input-data newly initialized',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][] | null> {
		const items = this.getInputData();

		const nodeContext = this.getContext('node');

		const batchSize = this.getNodeParameter('batchSize', 0) as number;

		const returnItems: INodeExecutionData[] = [];

		const options = this.getNodeParameter('options', 0, {}) as IDataObject;

		if (nodeContext.items === undefined || options.reset === true) {
			// Is the first time the node runs

			nodeContext.currentRunIndex = 0;
			nodeContext.maxRunIndex = Math.ceil(items.length / batchSize);

			// Set the other items to be saved in the context to return at later runs
			nodeContext.items = items;

			// Return this first batch of items
			if (items.length > 0) {
				if (batchSize === 1) {
					returnItems.push(...[items[0]]);
				} else {
					returnItems.push(...items.slice(0, batchSize));
				}
			} else {
				return null;
			}
		} else {
			// The node has been called before. So return the next batch of items.
			nodeContext.currentRunIndex += 1;
			nodeContext.noItemsLeft = nodeContext.items.length === 0;

			if (batchSize === 1) {
				const pos = nodeContext.currentRunIndex;
				if (pos < nodeContext.items.length) {
					returnItems.push(...[nodeContext.items[pos]]);
				}
			} else {
				const pos = nodeContext.currentRunIndex * batchSize;
				if (pos < nodeContext.items.length) {
					returnItems.push(...nodeContext.items.slice(pos, pos + batchSize));
				}
			}
			return null;
		}

		returnItems.map((item, index) => {
			item.pairedItem = {
				item: index,
			};
		});

		return this.prepareOutputData(returnItems);
	}
}
