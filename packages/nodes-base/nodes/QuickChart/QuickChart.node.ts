import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import _ from 'lodash';

interface IDataset {
	label?: string;
	// tslint:disable-next-line:no-any
	data: any;
	backgroundColor?: string;
	borderColor?: string;
	color?: string;
	type?: string;
	fill?: boolean;
}

function validateJSON(json: string | undefined) {
	//// tslint:disable-next-line:no-any
	let result;
	try {
		result = JSON.parse(json!);
	} catch (exception) {
		result = [];
	}
	return result;
}

const CHART_TYPE_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Bar Chart',
		value: 'bar',
	},
	{
		name: 'Bubble Chart',
		value: 'bubble',
	},
	{
		name: 'Doughnut Chart',
		value: 'doughnut',
	},
	{
		name: 'Line Chart',
		value: 'line',
	},
	{
		name: 'Pie Chart',
		value: 'pie',
	},
	{
		name: 'Polar Chart',
		value: 'polar',
	},
	{
		name: 'Radar Chart',
		value: 'radar',
	},
	{
		name: 'Radial Gauge',
		value: 'radialGauge',
	},
	{
		name: 'Scatter Chart',
		value: 'scatter',
	},
	{
		name: 'Sparkline',
		value: 'sparkline',
	},
];

export class QuickChart implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'QuickChart',
		name: 'quickChart',
		icon: 'file:quickChart.svg',
		group: ['output'],
		description: 'Creates a chart via QuickChart',
		version: 1,

		defaults: {
			name: 'QuickChart',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Chart Type',
				name: 'chartType',
				type: 'options',
				default: 'bar',
				options: CHART_TYPE_OPTIONS,
				description: 'The type of chart to create',
			},
			{
				displayName: 'JSON Labels',
				name: 'jsonLabels',
				type: 'boolean',
				default: false,
				description: 'Whether to use JSON data for chart labels',
			},
			{
				displayName: 'X Labels',
				name: 'labelsJson',
				type: 'json',
				default: '',
				required: true,
				description: 'Labels to use for the X Axis of the chart',
				placeholder: '["Apples", "Bananas", "Oranges"]',
				displayOptions: {
					show: {
						jsonLabels: [true],
					},
				},
			},
			{
				displayName: 'X Labels',
				name: 'labelsUi',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				required: true,
				description: 'Labels to use for the X Axis of the chart',
				displayOptions: {
					show: {
						jsonLabels: [false],
					},
				},
				placeholder: 'Add Label',
				options: [
					{
						name: 'labelsValues',
						displayName: 'Labels',
						values: [
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Data',
				name: 'data',
				type: 'json',
				default: '',
				description: 'Data to use for the dataset',
				required: true,
			},
			{
				displayName: 'Put Output In Field',
				name: 'output',
				type: 'string',
				default: 'data',
				required: true,
				description: 'The name of the output field to put the binary file data in',
			},
			{
				displayName: 'Dataset Options',
				name: 'datasetOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Background Color',
						name: 'backgroundColor',
						type: 'color',
						typeOptions: {
							showAlpha: true,
						},
						default: '',
						description:
							'Color used for the background the dataset (area of a line graph, fill of a bar chart, etc.)',
					},
					{
						displayName: 'Border Color',
						name: 'borderColor',
						type: 'color',
						typeOptions: {
							showAlpha: true,
						},
						default: '',
						description: 'Color used for lines of the dataset',
					},
					{
						displayName: 'Font Color',
						name: 'fontColor',
						type: 'color',
						typeOptions: {
							showAlpha: true,
						},
						default: '',
						description: 'Color used for the text the dataset',
					},
					{
						displayName: 'Chart Type',
						name: 'chartType',
						type: 'options',
						default: 'bar',
						options: CHART_TYPE_OPTIONS,
						description: 'The type of chart to use for the dataset',
					},
					{
						displayName: 'Fill',
						name: 'fill',
						type: 'boolean',
						default: true,
						description: 'Whether to fill area of the dataset',
					},
					{
						displayName: 'Label',
						name: 'label',
						type: 'string',
						default: '',
						description: 'The label of the dataset',
					},
				],
			},
			{
				displayName: 'Chart Options',
				name: 'chartOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Width',
						name: 'width',
						type: 'number',
						default: 500,
						description: 'Width of the chart',
					},
					{
						displayName: 'Height',
						name: 'height',
						type: 'number',
						default: 300,
						description: 'Height of the chart',
					},
					{
						displayName: 'Device Pixel Ratio',
						name: 'devicePixelRatio',
						type: 'number',
						default: 2,
						typeOptions: {
							numberPrecision: 2,
						},
						description: 'Pixel ratio of the chart',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						default: 'png',
						description: 'File format of the resulting chart',
						options: [
							{
								name: 'PNG',
								value: 'png',
							},
							{
								name: 'SVG',
								value: 'svg',
							},
							{
								name: 'WebP',
								value: 'webp',
							},
							{
								name: 'PDF',
								value: 'pdf',
							},
						],
					},
					{
						displayName: 'Background Color',
						name: 'backgroundColor',
						type: 'color',
						default: '',
						description: 'Background color of the chart',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const datasets: IDataset[] = [];
		const chartType = this.getNodeParameter('chartType', 0) as string;

		// tslint:disable-next-line:no-any
		let labels: any[] | undefined;
		const jsonActive = this.getNodeParameter('jsonLabels', 0) as boolean;
		if (jsonActive) {
			labels = validateJSON(this.getNodeParameter('labelsJson', 0) as string);
		} else {
			const labelsUi = this.getNodeParameter('labelsUi', 0) as IDataObject;
			if (!_.isEmpty(labelsUi)) {
				labels = (labelsUi.labelsValues! as IDataObject[]).map((l: IDataObject) => l.label);
			}
		}

		for (let i = 0; i < items.length; i++) {
			// tslint:disable-next-line:no-any
			const data = this.getNodeParameter('data', i) as any;
			const datasetOptions = this.getNodeParameter('datasetOptions', i) as IDataObject;
			const backgroundColor = datasetOptions.backgroundColor as string | undefined;
			const borderColor = datasetOptions.borderColor as string | undefined;
			const fontColor = datasetOptions.fontColor as string | undefined;
			const datasetChartType = datasetOptions.chartType as string;
			const fill = datasetOptions.fill as boolean | undefined;
			const label = datasetOptions.label as string | undefined;
			datasets.push({
				label,
				data,
				backgroundColor,
				borderColor,
				color: fontColor,
				type: datasetChartType,
				fill,
			});
		}

		const output = this.getNodeParameter('output', 0) as string;
		const chartOptions = this.getNodeParameter('chartOptions', 0);
		const options: IHttpRequestOptions = {
			method: 'GET',
			url: 'https://quickchart.io/chart',
			qs: Object.assign(
				{
					chart: JSON.stringify({
						type: chartType,
						data: {
							labels,
							datasets,
						},
					}),
				},
				chartOptions,
			) as IDataObject,
			returnFullResponse: true,
			encoding: 'arraybuffer',
			json: false,
		};
		const response = (await this.helpers.httpRequest(options)) as IN8nHttpFullResponse;
		let mimeType = response.headers['content-type'] as string | undefined;
		mimeType = mimeType ? mimeType.split(';').find((value) => value.includes('/')) : undefined;
		return this.prepareOutputData([
			{
				binary: {
					[output]: await this.helpers.prepareBinaryData(response.body, undefined, mimeType),
				},
				json: {},
			},
		]);
	}
}
