import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { BINARY_ENCODING, NodeOperationError } from 'n8n-workflow';

import type { Readable } from 'stream';

import { updateDisplayOptions } from '@utils/utilities';

export const properties: INodeProperties[] = [
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. /data/example.jpg',
		description: 'Path to which the file should be written',
	},
	{
		displayName: 'File Property',
		name: 'dataPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		description: 'Name of the binary property which contains the data for the file to be written',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Append',
				name: 'append',
				type: 'boolean',
				default: false,
				description: 'Whether to append to an existing file',
			},
		],
	},
];

const displayOptions = {
	show: {
		operation: ['write'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, items: INodeExecutionData[]) {
	const returnData: INodeExecutionData[] = [];

	let item: INodeExecutionData;
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const dataPropertyName = this.getNodeParameter('dataPropertyName', itemIndex);
			const fileName = this.getNodeParameter('fileName', itemIndex) as string;
			const options = this.getNodeParameter('options', itemIndex, {});
			const flag: string = options.append ? 'a' : 'w';

			item = items[itemIndex];

			const newItem: INodeExecutionData = {
				json: {},
				pairedItem: {
					item: itemIndex,
				},
			};
			Object.assign(newItem.json, item.json);

			const binaryData = this.helpers.assertBinaryData(itemIndex, dataPropertyName);

			let fileContent: Buffer | Readable;
			if (binaryData.id) {
				fileContent = await this.helpers.getBinaryStream(binaryData.id);
			} else {
				fileContent = Buffer.from(binaryData.data, BINARY_ENCODING);
			}

			// Write the file to disk
			await this.helpers.writeContentToFile(fileName, fileContent, flag);

			if (item.binary !== undefined) {
				// Create a shallow copy of the binary data so that the old
				// data references which do not get changed still stay behind
				// but the incoming data does not get changed.
				newItem.binary = {};
				Object.assign(newItem.binary, item.binary);
			}

			// Add the file name to data
			newItem.json.fileName = fileName;

			returnData.push(newItem);
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: {
						error: error.message,
					},
					pairedItem: {
						item: itemIndex,
					},
				});
				continue;
			}
			throw new NodeOperationError(this.getNode(), error, { itemIndex });
		}
	}

	return returnData;
}
