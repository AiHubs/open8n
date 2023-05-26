import type { IExecuteFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { updateDisplayOptions } from '../../../../../../utils/utilities';
import { driveRLC, folderRLC } from '../common.descriptions';
import { googleApiRequest, googleApiRequestAllItems } from '../../transport';
import { prepareQueryString } from '../../helpers/utils';
import type { SearchFilter } from '../../helpers/interfaces';
import { DRIVE, RLC_DRIVE_DEFAULT, RLC_FOLDER_DEFAULT } from '../../helpers/interfaces';

const properties: INodeProperties[] = [
	{
		displayName: 'Search Method',
		name: 'searchMethod',
		type: 'options',
		options: [
			{
				name: 'Search File/Folder Name',
				value: 'name',
			},
			{
				name: 'Advanced Search',
				value: 'query',
			},
		],
		default: 'name',
		description: 'Whether to search for the file/folder name or use a query string',
	},
	{
		displayName: 'Search Query',
		name: 'queryString',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				searchMethod: ['name'],
			},
		},
		placeholder: 'e.g. My File / My Folder',
		description:
			'The name of the file or folder to search for. Returns also files and folders whose names partially match this search term.',
	},
	{
		displayName: 'Query String',
		name: 'queryString',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				searchMethod: ['query'],
			},
		},
		placeholder: "e.g. not name contains 'hello'",
		description:
			'Use the Google query strings syntax to search for a specific set of files or folders. <a href="https://developers.google.com/drive/api/v3/search-files" target="_blank">Learn more</a>.',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Max number of results to return',
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Filter',
		name: 'filter',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		options: [
			{ ...driveRLC, required: false },
			{ ...folderRLC, required: false },
			{
				displayName: 'What to Search',
				name: 'whatToSearch',
				type: 'options',
				default: 'all',
				description:
					'Narrows the search within the selected folder. By default, the root folder is used.',
				options: [
					{
						name: 'Files and Folders',
						value: 'all',
					},
					{
						name: 'Files',
						value: 'files',
					},
					{
						name: 'Folders',
						value: 'folders',
					},
				],
			},
			{
				displayName: 'Drive File Types',
				name: 'fileTypes',
				type: 'multiOptions',
				default: [],
				description:
					'Return only items corresponding to the selected types. Those mime types are specific to Google Drive, to filter by file extension use the "Additional Mime Types" option.',
				// eslint-disable-next-line n8n-nodes-base/node-param-multi-options-type-unsorted-items
				options: [
					{
						name: 'All',
						value: '*',
						description: 'Return all file types',
					},
					{
						name: '3rd Party Shortcut',
						value: DRIVE.SDK,
					},
					{
						name: 'Audio',
						value: DRIVE.AUDIO,
					},
					{
						name: 'Google Apps Scripts',
						value: DRIVE.APP_SCRIPTS,
					},
					{
						name: 'Google Docs',
						value: DRIVE.DOCUMENT,
					},
					{
						name: 'Google Drawing',
						value: DRIVE.DRAWING,
					},
					{
						name: 'Google Forms',
						value: DRIVE.FORM,
					},
					{
						name: 'Google Fusion Tables',
						value: DRIVE.FUSIONTABLE,
					},
					{
						name: 'Google My Maps',
						value: DRIVE.MAP,
					},
					{
						name: 'Google Sheets',
						value: DRIVE.SPREADSHEET,
					},
					{
						name: 'Google Sites',
						value: DRIVE.SITES,
					},
					{
						name: 'Google Slides',
						value: DRIVE.PRESENTATION,
					},
					{
						name: 'Photo',
						value: DRIVE.PHOTO,
					},
					{
						name: 'Unknown',
						value: DRIVE.UNKNOWN,
					},
					{
						name: 'Video',
						value: DRIVE.VIDEO,
					},
				],
				displayOptions: {
					hide: {
						whatToSearch: ['folders'],
					},
				},
			},
			{
				displayName: 'Include Trashed Items',
				name: 'includeTrashed',
				type: 'boolean',
				default: false,
				description: "Whether to return also items in the Drive's bin",
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				options: [
					{
						name: '*',
						value: '*',
						description: 'All fields',
					},
					{
						name: 'explicitlyTrashed',
						value: 'explicitlyTrashed',
					},
					{
						name: 'exportLinks',
						value: 'exportLinks',
					},
					{
						name: 'hasThumbnail',
						value: 'hasThumbnail',
					},
					{
						name: 'iconLink',
						value: 'iconLink',
					},
					{
						name: 'ID',
						value: 'id',
					},
					{
						name: 'Kind',
						value: 'kind',
					},
					{
						name: 'mimeType',
						value: 'mimeType',
					},
					{
						name: 'Name',
						value: 'name',
					},
					{
						name: 'Permissions',
						value: 'permissions',
					},
					{
						name: 'Shared',
						value: 'shared',
					},
					{
						name: 'Spaces',
						value: 'spaces',
					},
					{
						name: 'Starred',
						value: 'starred',
					},
					{
						name: 'thumbnailLink',
						value: 'thumbnailLink',
					},
					{
						name: 'Trashed',
						value: 'trashed',
					},
					{
						name: 'Version',
						value: 'version',
					},
					{
						name: 'webViewLink',
						value: 'webViewLink',
					},
				],
				default: [],
				description: 'The fields to return',
			},
		],
	},
];

const displayOptions = {
	show: {
		resource: ['fileFolder'],
		operation: ['search'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	i: number,
	options: IDataObject,
): Promise<INodeExecutionData[]> {
	const searchMethod = this.getNodeParameter('searchMethod', i) as string;

	const query = [];

	const queryString = this.getNodeParameter('queryString', i) as string;

	if (searchMethod === 'name') {
		query.push(`name contains '${queryString}'`);
	} else {
		query.push(queryString);
	}

	const filter = this.getNodeParameter('filter', i, {}) as SearchFilter;

	let driveId = '';
	const returnedTypes: string[] = [];

	if (Object.keys(filter)?.length) {
		if (filter.folderId && filter.folderId.value !== RLC_FOLDER_DEFAULT) {
			let value;
			if (filter.folderId.mode === 'url') {
				value = this.getNodeParameter('filter.folderId', i, undefined, {
					extractValue: true,
				}) as string;
			} else {
				value = filter.folderId.value;
			}

			query.push(`'${value}' in parents`);
		}

		if (filter.driveId && filter.driveId.value !== RLC_DRIVE_DEFAULT) {
			let value;
			if (filter.driveId.mode === 'url') {
				value = this.getNodeParameter('filter.driveId', i, undefined, {
					extractValue: true,
				}) as string;
			} else {
				value = filter.driveId.value;
			}
			driveId = value;
		}

		const whatToSearch = filter.whatToSearch || 'all';
		if (whatToSearch === 'folders') {
			query.push(`mimeType = '${DRIVE.FOLDER}'`);
		} else {
			if (whatToSearch === 'files') {
				query.push(`mimeType != '${DRIVE.FOLDER}'`);
			}

			if (filter?.fileTypes?.length && !filter.fileTypes.includes('*')) {
				filter.fileTypes.forEach((fileType: string) => {
					returnedTypes.push(`mimeType = '${fileType}'`);
				});
			}
		}

		if (!filter.includeTrashed) {
			query.push('trashed = false');
		}
	}

	if (returnedTypes.length) {
		query.push(`(${returnedTypes.join(' or ')})`);
	}

	const queryFields = prepareQueryString(options.fields as string[]);

	const qs: IDataObject = {
		fields: `nextPageToken, files(${queryFields})`,
		q: query.filter((q) => q).join(' and '),
		includeItemsFromAllDrives: true,
		supportsAllDrives: true,
		spaces: 'appDataFolder, drive',
		corpora: 'allDrives',
	};

	if (driveId) {
		qs.driveId = driveId;
		qs.corpora = 'drive';
	}

	const returnAll = this.getNodeParameter('returnAll', i, false);

	let response;
	if (returnAll) {
		response = await googleApiRequestAllItems.call(this, 'GET', 'files', '/drive/v3/files', {}, qs);
	} else {
		qs.pageSize = this.getNodeParameter('limit', i);
		response = await googleApiRequest.call(this, 'GET', '/drive/v3/files', undefined, qs);
		response = response.files;
	}

	const executionData = this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(response as IDataObject[]),
		{ itemData: { item: i } },
	);

	return executionData;
}
