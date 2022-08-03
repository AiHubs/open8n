import { INodePropertyOptions } from 'n8n-workflow';

export const CHART_TYPE_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Bar Chart',
		value: 'bar',
	},
	{
		name: 'Boxplot',
		value: 'boxplot',
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
	{
		name: 'Violin Chart',
		value: 'violin',
	},
];

export const HORIZONTAL_CHARTS = ['bar', 'boxplot', 'violin'];
export const ITEM_STYLE_CHARTS = ['boxplot', 'horizontalBoxplot', 'violin', 'horizontalViolin'];
