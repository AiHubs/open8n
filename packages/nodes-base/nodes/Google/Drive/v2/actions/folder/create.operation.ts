import type { IExecuteFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { updateDisplayOptions } from '../../../../../../utils/utilities';
import { googleApiRequest } from '../../transport';
import { folderRLC } from '../common.descriptions';
import { DRIVE } from '../../helpers/interfaces';

const properties: INodeProperties[] = [
	{
		displayName: 'Folder Name',
		name: 'name',
		type: 'string',
		default: '',
		placeholder: 'e.g. New Folder',
		description: "The name of the new folder. If not set, 'Untitled' will be used.",
	},
	{
		...folderRLC,
		displayName: 'Parent Folder',
		name: 'parentFolder',
		description: 'Where to create the new folder. By default, the root of the Drive is used.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Simplify Output',
				name: 'simplifyOutput',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the all fields',
			},
			{
				displayName: 'Folder Color',
				name: 'folderColorRgb',
				type: 'color',
				default: '',
				description:
					'The color of the folder as an RGB hex string. If an unsupported color is specified, the closest color in the palette will be used instead.',
			},
		],
	},
];

const displayOptions = {
	show: {
		resource: ['folder'],
		operation: ['create'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const name = (this.getNodeParameter('name', i) as string) || 'Untitled';

	const parentFolder = this.getNodeParameter('parentFolder', i, undefined, {
		extractValue: true,
	}) as string;

	const body: IDataObject = {
		name,
		mimeType: DRIVE.FOLDER,
		parents: [parentFolder],
	};

	const folderColorRgb =
		(this.getNodeParameter('options.folderColorRgb', i, '') as string) || undefined;
	if (folderColorRgb) {
		body.folderColorRgb = folderColorRgb;
	}

	const simplifyOutput = this.getNodeParameter('options.simplifyOutput', i, true) as boolean;
	let fields;
	if (!simplifyOutput) {
		fields = '*';
	}

	const qs = {
		fields,
		supportsAllDrives: true,
	};

	const response = await googleApiRequest.call(this, 'POST', '/drive/v3/files', body, qs);

	const executionData = this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(response as IDataObject[]),
		{ itemData: { item: i } },
	);

	return executionData;
}
