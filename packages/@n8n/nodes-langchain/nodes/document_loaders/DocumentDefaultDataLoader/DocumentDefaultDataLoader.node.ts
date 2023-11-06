/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	NodeConnectionType,
	type IExecuteFunctions,
	type INodeType,
	type INodeTypeDescription,
	type SupplyData,
} from 'n8n-workflow';

import { logWrapper } from '../../../utils/logWrapper';
import { N8nBinaryLoader } from '../../../utils/N8nBinaryLoader';
import { metadataFilterField } from '../../../utils/sharedFields';

// Dependencies needed underneath the hood for the loaders. We add them
// here only to track where what dependency is sued
// import 'd3-dsv'; // for csv
import 'mammoth'; // for docx
import '@gxl/epub-parser'; // for epub
import 'pdf-parse'; // for pdf
import { N8nJsonLoader } from '../../../utils/N8nJsonLoader';

export class DocumentDefaultDataLoader implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Default Data Loader',
		name: 'documentDefaultDataLoader',
		icon: 'file:binary.svg',
		group: ['transform'],
		version: 1,
		description: 'Load data from previous step in the workflow',
		defaults: {
			name: 'Default Data Loader',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Document Loaders'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.documentdefaultdataloader/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [
			{
				displayName: 'Text Splitter',
				maxConnections: 1,
				type: NodeConnectionType.AiTextSplitter,
				required: true,
			},
		],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiDocument],
		outputNames: ['Document'],
		properties: [
			{
				displayName: 'This will load data from a previous step in the workflow',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Type of Data',
				name: 'dataType',
				type: 'options',
				default: 'json',
				required: true,
				noDataExpression: true,
				options: [
					{
						name: 'JSON',
						value: 'json',
						description: 'Process JSON data from previous step in the workflow',
					},
					{
						name: 'Binary',
						value: 'binary',
						description: 'Process binary data from previous step in the workflow',
					},
				],
			},
			{
				displayName: 'Data Format',
				name: 'loader',
				type: 'options',
				default: 'auto',
				required: true,
				displayOptions: {
					show: {
						dataType: ['binary'],
					},
				},
				options: [
					{
						name: 'Automatically Detect by Mime Type',
						value: 'auto',
						description: 'Uses the mime type to detect the format',
					},
					{
						name: 'CSV',
						value: 'csvLoader',
						description: 'Load CSV files',
					},
					{
						name: 'Docx',
						value: 'docxLoader',
						description: 'Load Docx documents',
					},
					{
						name: 'EPub',
						value: 'epubLoader',
						description: 'Load EPub files',
					},
					{
						name: 'JSON',
						value: 'jsonLoader',
						description: 'Load JSON files',
					},
					{
						name: 'PDF',
						value: 'pdfLoader',
						description: 'Load PDF documents',
					},
					{
						name: 'Text',
						value: 'textLoader',
						description: 'Load plain text files',
					},
				],
			},
			{
				displayName: 'Binary Data Key',
				name: 'binaryDataKey',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property from which to read the file buffer',
				displayOptions: {
					show: {
						dataType: ['binary'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'JSON Pointers',
						name: 'pointers',
						type: 'string',
						default: '',
						description: 'Pointers to extract from JSON, e.g. "/text" or "/text, /meta/title"',
						displayOptions: {
							show: {
								'/loader': ['json', 'auto'],
							},
						},
					},
					{
						displayName: 'Pointers',
						name: 'pointers',
						type: 'string',
						default: '',
						description: 'Pointers to extract from JSON, e.g. "/text" or "/text, /meta/title"',
						displayOptions: {
							show: {
								'/dataType': ['json'],
							},
						},
					},
					{
						displayName: 'CSV Separator',
						name: 'separator',
						type: 'string',
						description: 'Separator to use for CSV',
						default: ',',
						displayOptions: {
							show: {
								'/loader': ['csv', 'auto'],
							},
						},
					},
					{
						displayName: 'CSV Column',
						name: 'column',
						type: 'string',
						default: '',
						description: 'Column to extract from CSV',
						displayOptions: {
							show: {
								'/loader': ['csv', 'auto'],
							},
						},
					},
					{
						displayName: 'Split Pages in PDF',
						description: 'Whether to split PDF pages into separate documents',
						name: 'splitPages',
						type: 'boolean',
						default: true,
						displayOptions: {
							show: {
								'/loader': ['pdf', 'auto'],
							},
						},
					},
					{
						...metadataFilterField,
						displayName: 'Metadata',
						description:
							'Metadata to add to each document. Could be used for filtering during retrieval',
						placeholder: 'Add property',
					},
				],
			},
		],
	};

	async supplyData(this: IExecuteFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.verbose('Supply Data for Binary Input Loader');
		const dataType = this.getNodeParameter('dataType', itemIndex, 'json') as 'json' | 'binary';

		const processor =
			dataType === 'binary'
				? new N8nBinaryLoader(this, 'options.')
				: new N8nJsonLoader(this, 'options.');

		return {
			response: logWrapper(processor, this),
		};
	}
}
