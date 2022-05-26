import { INodeProperties } from 'n8n-workflow';

export const fileDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Delete',
				value: 'delete',
			},
			{
				name: 'Download',
				value: 'download',
			},
			{
				name: 'Upload',
				value: 'upload',
			},
		],
		default: 'upload',
		displayOptions: {
			show: {
				resource: [
					'file',
				],
			},
		},
	},
	// Upload --------------------------------------------------------------------------
	{
		displayName: 'File Location',
		name: 'fileLocation',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: ['upload'],
				resource: ['file'],
			},
		},
		default: '/nsconfig/ssl/',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: ['upload'],
				resource: ['file'],
			},
		},
		default: 'data',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['upload'],
				resource: ['file'],
			},
		},
		options: [
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'Name of the file. It should not include filepath.',
			},
		],
	},
	// Delete, Download ---------------------------------------------------------------
	{
		displayName: 'File Location',
		name: 'fileLocation',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: ['delete', 'download' ],
				resource: ['file'],
			},
		},
		default: '/nsconfig/ssl/',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		required: true,
		description: 'Name of the file. It should not include filepath.',
		displayOptions: {
			show: {
				operation: ['delete', 'download' ],
				resource: ['file'],
			},
		},
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		required: true,
		default: 'data',
		description: 'Name of the binary property to which to write to.',
		displayOptions: {
			show: {
				operation: ['download' ],
				resource: ['file'],
			},
		},
	},
];
