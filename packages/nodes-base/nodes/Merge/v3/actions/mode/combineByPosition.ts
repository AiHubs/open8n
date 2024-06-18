import {
	NodeExecutionOutput,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeProperties,
	type IPairedItemData,
} from 'n8n-workflow';

import { updateDisplayOptions } from '@utils/utilities';

import type { ClashResolveOptions } from '../../helpers/interfaces';
import { clashHandlingProperties, numberInputsProperty } from '../../helpers/descriptions';
import { addSuffixToEntriesKeys, selectMergeMethod } from '../../helpers/utils';

import merge from 'lodash/merge';

export const properties: INodeProperties[] = [
	numberInputsProperty,
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			clashHandlingProperties,
			{
				displayName: 'Include Any Unpaired Items',
				name: 'includeUnpaired',
				type: 'boolean',
				default: false,
				description:
					'Whether unpaired items should be included in the result when there are differing numbers of items among the inputs',
			},
		],
	},
];

const displayOptions = {
	show: {
		operation: ['combineByPosition'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	inputsData: INodeExecutionData[][],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	const clashHandling = this.getNodeParameter(
		'options.clashHandling.values',
		0,
		{},
	) as ClashResolveOptions;
	const includeUnpaired = this.getNodeParameter('options.includeUnpaired', 0, false) as boolean;

	let preferedInputIndex: number;

	if (clashHandling?.resolveClash?.includes('preferInput')) {
		preferedInputIndex = Number(clashHandling.resolveClash.replace('preferInput', '')) - 1;
	} else {
		preferedInputIndex = inputsData.length - 1;
	}

	const prefered = inputsData[preferedInputIndex];

	if (clashHandling.resolveClash === 'addSuffix') {
		for (const [inputIndex, input] of inputsData.entries()) {
			inputsData[inputIndex] = addSuffixToEntriesKeys(input, String(inputIndex + 1));
		}
	}

	let numEntries: number;
	if (includeUnpaired) {
		numEntries = Math.max(...inputsData.map((input) => input.length), prefered.length);
	} else {
		numEntries = Math.min(...inputsData.map((input) => input.length), prefered.length);
		if (numEntries === 0) {
			return new NodeExecutionOutput(
				[returnData],
				[
					{
						message:
							'Consider enabling "Include Any Unpaired Items" in options or check your inputs',
					},
				],
			);
		}
	}

	const mergeIntoSingleObject = selectMergeMethod(clashHandling);

	for (let i = 0; i < numEntries; i++) {
		const preferedEntry = prefered[i] ?? {};
		const restEntries = inputsData.map((input) => input[i] ?? {});

		const json = {
			...mergeIntoSingleObject(
				{},
				...restEntries.map((entry) => entry.json ?? {}),
				preferedEntry.json ?? {},
			),
		};

		const binary = {
			...merge({}, ...restEntries.map((entry) => entry.binary ?? {}), preferedEntry.binary ?? {}),
		};

		const pairedItem = [
			...restEntries.map((entry) => entry.pairedItem as IPairedItemData).flat(),
			preferedEntry.pairedItem as IPairedItemData,
		].filter((item) => item !== undefined);

		returnData.push({ json, binary, pairedItem });
	}

	return returnData;
}
