import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';

type AggregationType =
	| 'append'
	| 'average'
	| 'concatenate'
	| 'count'
	| 'countUnique'
	| 'max'
	| 'min'
	| 'sum';

type Aggregation = {
	aggregation: AggregationType;
	field: string;
	ignoreNonNumericalValues?: boolean;
	includeEmpty?: boolean;
	separateBy?: string;
	customSeparator?: string;
};

type Aggregations = Aggregation[];

enum AggregationDisplayNames {
	append = 'appended_',
	average = 'average_',
	concatenate = 'concatenated_',
	count = 'count_',
	countUnique = 'unique_count_',
	max = 'max_',
	min = 'min_',
	sum = 'sum_',
}

const NUMERICAL_AGGREGATIONS = ['average', 'max', 'min', 'sum'];

export const description: INodeProperties[] = [
	{
		displayName: 'Fields to Summarize',
		name: 'fieldsToSummarize',
		type: 'fixedCollection',
		placeholder: 'Add Field',
		default: { values: [{ aggregation: 'count', field: '' }] },
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: '',
				name: 'values',
				values: [
					{
						displayName: 'Aggregation',
						name: 'aggregation',
						type: 'options',
						options: [
							{
								name: 'Append',
								value: 'append',
							},
							{
								name: 'Average',
								value: 'average',
							},
							{
								name: 'Concatenate',
								value: 'concatenate',
							},
							{
								name: 'Count',
								value: 'count',
							},
							{
								name: 'Count Unique',
								value: 'countUnique',
							},
							{
								name: 'Max',
								value: 'max',
							},
							{
								name: 'Min',
								value: 'min',
							},
							{
								name: 'Sum',
								value: 'sum',
							},
						],
						default: 'count',
						description: 'How to combine the values of the field you want to summarize',
					},
					//field repeated to have different descriptions for different aggregations --------------------------------
					{
						displayName: 'Field',
						name: 'field',
						type: 'string',
						default: '',
						required: true,
						description: 'The name of an input field that you want to summarize',
						placeholder: 'e.g. cost',
						hint: ' Enter the field name as text',
						displayOptions: {
							hide: {
								aggregation: [...NUMERICAL_AGGREGATIONS, 'countUnique', 'count'],
							},
						},
					},
					{
						displayName: 'Field',
						name: 'field',
						type: 'string',
						default: '',
						required: true,
						description:
							'The name of an input field that you want to summarize. The field should contain numerical values; null, undefined, emty strings would be ignored.',
						placeholder: 'e.g. cost',
						hint: ' Enter the field name as text',
						displayOptions: {
							show: {
								aggregation: NUMERICAL_AGGREGATIONS,
							},
						},
					},
					{
						displayName: 'Field',
						name: 'field',
						type: 'string',
						default: '',
						required: true,
						description:
							'The name of an input field that you want to summarize; null, undefined, emty strings would be ignored',
						placeholder: 'e.g. cost',
						hint: ' Enter the field name as text',
						displayOptions: {
							show: {
								aggregation: ['countUnique', 'count'],
							},
						},
					},
					//----------------------------------------------------------------------------------------------------------------
					{
						// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
						displayName: "Ignore values that aren't numbers",
						name: 'ignoreNonNumericalValues',
						description: "Whether this isn't enabled, non-numerical values will cause an error",
						type: 'boolean',
						default: false,
						displayOptions: {
							show: {
								aggregation: NUMERICAL_AGGREGATIONS,
							},
						},
					},
					{
						displayName: 'Include Empty Values',
						name: 'includeEmpty',
						type: 'boolean',
						default: false,
						displayOptions: {
							show: {
								aggregation: ['append', 'concatenate'],
							},
						},
					},
					{
						displayName: 'Separator',
						name: 'separateBy',
						type: 'options',
						default: ',',
						// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
						options: [
							{
								name: 'Comma',
								value: ',',
							},
							{
								name: 'Comma and Space',
								value: ', ',
							},
							{
								name: 'New Line',
								value: '\n',
							},
							{
								name: 'None',
								value: '',
							},
							{
								name: 'Space',
								value: ' ',
							},
							{
								name: 'Other',
								value: 'other',
							},
						],
						hint: 'What to insert between values',
						displayOptions: {
							show: {
								aggregation: ['concatenate'],
							},
						},
					},
					{
						displayName: 'Custom Separator',
						name: 'customSeparator',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								aggregation: ['concatenate'],
								separateBy: ['other'],
							},
						},
					},
				],
			},
		],
		displayOptions: {
			show: {
				resource: ['itemList'],
				operation: ['summarize'],
			},
		},
	},
	{
		displayName: 'Fields to Split By',
		name: 'fieldsToSplitBy',
		type: 'string',
		placeholder: 'e.g. country, city',
		default: '',
		description: 'The name of the input fields that you want to split the summary by',
		hint: 'Enter the name of the fields as text (separated by commas)',
		displayOptions: {
			show: {
				resource: ['itemList'],
				operation: ['summarize'],
			},
			hide: {
				'/options.outputDataAsObject': [true],
			},
		},
	},
	{
		displayName: 'Fields to Group By',
		name: 'fieldsToSplitBy',
		type: 'string',
		placeholder: 'e.g. country, city',
		default: '',
		description: 'The name of the input fields that you want to split the summary by',
		hint: 'Enter the name of the fields as text (separated by commas)',
		displayOptions: {
			show: {
				resource: ['itemList'],
				operation: ['summarize'],
				'/options.outputDataAsObject': [true],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['itemList'],
				operation: ['summarize'],
			},
		},
		options: [
			{
				displayName: 'Output Data as Object',
				name: 'outputDataAsObject',
				type: 'boolean',
				default: false,
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
				displayName: 'Ignore items without valid fields to group by',
				name: 'skipEmptySplitFields',
				type: 'boolean',
				default: false,
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[][]> {
	const newItems = items.map(({ json }) => json);

	const outputDataAsObject = this.getNodeParameter(
		'options.outputDataAsObject',
		0,
		false,
	) as boolean;

	const skipEmptySplitFields = this.getNodeParameter(
		'options.skipEmptySplitFields',
		0,
		false,
	) as boolean;

	const fieldsToSplitBy = (this.getNodeParameter('fieldsToSplitBy', 0, '') as string)
		.split(',')
		.map((field) => field.trim())
		.filter((field) => field);

	const fieldsToSummarize = this.getNodeParameter(
		'fieldsToSummarize.values',
		0,
		[],
	) as Aggregations;

	if (fieldsToSummarize.length === 0) {
		return this.prepareOutputData(
			this.helpers.returnJsonArray(aggregateData(newItems, fieldsToSummarize)),
		);
	}

	checkIfFieldExists.call(this, newItems, fieldsToSummarize);
	checkAggregationsFieldType.call(this, newItems, fieldsToSummarize);

	const aggregationResult = splitData(
		fieldsToSplitBy,
		newItems,
		fieldsToSummarize,
		skipEmptySplitFields,
	);

	const result =
		outputDataAsObject || !fieldsToSplitBy.length
			? aggregationResult
			: aggregationToArray(aggregationResult, fieldsToSplitBy);

	const executionData = this.prepareOutputData(this.helpers.returnJsonArray(result));

	return executionData;
}

function checkIfFieldExists(
	this: IExecuteFunctions,
	items: IDataObject[],
	aggregations: Aggregations,
) {
	for (const aggregation of aggregations) {
		const exist = items.some((item) => Object.keys(item).includes(aggregation.field));
		if (!exist) {
			throw new NodeOperationError(
				this.getNode(),
				`The field '${aggregation.field}' does not exist in any items`,
			);
		}
	}
}

function isEmpty<T>(value: T) {
	return value === undefined || value === null || value === '';
}

function checkAggregationsFieldType(
	this: IExecuteFunctions,
	items: IDataObject[],
	aggregations: Aggregations,
) {
	const numericAggregations = aggregations
		.filter(
			(entry) =>
				NUMERICAL_AGGREGATIONS.includes(entry.aggregation) && !entry.ignoreNonNumericalValues,
		)
		.map((entry) => entry);

	for (const [index, item] of items.entries()) {
		for (const entry of numericAggregations) {
			if (!isEmpty(item[entry.field]) && typeof item[entry.field] !== 'number') {
				throw new NodeOperationError(
					this.getNode(),
					`The field '${entry.field}' is not a number in [item ${index}], so can't perform ${entry.aggregation}`,
					{ description: "To avoid this error, enable 'Ignore values that aren't numbers'" },
				);
			}
		}
	}
}

function splitData(
	splitKeys: string[],
	data: IDataObject[],
	fieldsToSummarize: Aggregations,
	skipEmptySplitFields = false,
) {
	if (!splitKeys || splitKeys.length === 0) {
		return aggregateData(data, fieldsToSummarize);
	}

	const [firstSplitKey, ...restSplitKeys] = splitKeys;

	const groupedData = data.reduce((acc, item) => {
		const keyValuee = item[firstSplitKey] as string;

		if (skipEmptySplitFields && typeof keyValuee !== 'number' && !keyValuee) {
			return acc;
		}

		if (acc[keyValuee] === undefined) {
			acc[keyValuee] = [item];
		} else {
			(acc[keyValuee] as IDataObject[]).push(item);
		}
		return acc;
	}, {} as IDataObject);

	return Object.keys(groupedData).reduce((acc, key) => {
		const value = groupedData[key] as IDataObject[];
		acc[key] = splitData(restSplitKeys, value, fieldsToSummarize, skipEmptySplitFields);
		return acc;
	}, {} as IDataObject);
}

function aggregate(items: IDataObject[], entry: Aggregation) {
	const { aggregation, field } = entry;
	let data = [...items];

	if (NUMERICAL_AGGREGATIONS.includes(aggregation)) {
		entry.ignoreNonNumericalValues
			? (data = data.filter((item) => typeof item[field] === 'number' && !isEmpty(item[field])))
			: (data = data.filter((item) => !isEmpty(item[field])));
	}

	switch (aggregation) {
		//combine operations
		case 'append':
			if (!entry.includeEmpty) {
				data = data.filter((item) => !isEmpty(item[field]));
			}
			return data.map((item) => item[field]);
		case 'concatenate':
			const separateBy = entry.separateBy === 'other' ? entry.customSeparator : entry.separateBy;
			if (!entry.includeEmpty) {
				data = data.filter((item) => !isEmpty(item[field]));
			}
			return data
				.map((item) => {
					let value = item[field];
					if (typeof value === 'object') {
						value = JSON.stringify(value);
					}
					if (typeof value === 'undefined') {
						value = 'undefined';
					}

					return value;
				})
				.join(separateBy);

		//numerical operations
		case 'average':
			return (
				data.reduce((acc, item) => {
					return acc + (item[field] as number);
				}, 0) / data.length
			);
		case 'sum':
			return data.reduce((acc, item) => {
				return acc + (item[field] as number);
			}, 0);
		case 'min':
			return Math.min(
				...(data.map((item) => {
					return item[field];
				}) as number[]),
			);
		case 'max':
			return Math.max(
				...(data.map((item) => {
					return item[field];
				}) as number[]),
			);

		//count operations
		case 'countUnique':
			return new Set(data.map((item) => item[field]).filter((item) => !isEmpty(item))).size;
		default:
			//count by default
			return data.filter((item) => !isEmpty(item[field])).length;
	}
}

function aggregateData(data: IDataObject[], fieldsToSummarize: Aggregations) {
	return fieldsToSummarize.reduce((acc, entry) => {
		acc[`${AggregationDisplayNames[entry.aggregation]}${entry.field}`] = aggregate(data, entry);
		return acc;
	}, {} as IDataObject);
}

function aggregationToArray(
	aggregationResult: IDataObject,
	fieldsToSplitBy: string[],
	previousStage: IDataObject = {},
) {
	const returnData: IDataObject[] = [];

	const splitFieldName = fieldsToSplitBy[0];
	const isNext = fieldsToSplitBy[1];

	if (isNext === undefined) {
		for (const fieldName of Object.keys(aggregationResult)) {
			returnData.push({
				...previousStage,
				[splitFieldName]: fieldName,
				...(aggregationResult[fieldName] as IDataObject),
			});
		}
		return returnData;
	} else {
		for (const key of Object.keys(aggregationResult)) {
			returnData.push(
				...aggregationToArray(aggregationResult[key] as IDataObject, fieldsToSplitBy.slice(1), {
					...previousStage,
					[splitFieldName]: key,
				}),
			);
		}
		return returnData;
	}
}
