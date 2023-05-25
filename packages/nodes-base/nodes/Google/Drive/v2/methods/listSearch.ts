import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { googleApiRequest } from '../transport';
import { DRIVE, RLC_DRIVE_DEFAULT, RLC_FOLDER_DEFAULT } from '../helpers/interfaces';

interface GoogleDriveFilesItem {
	id: string;
	name: string;
	mimeType: string;
	webViewLink: string;
}

interface GoogleDriveDriveItem {
	id: string;
	name: string;
}

export async function fileSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const query: string[] = [];
	if (filter) {
		query.push(`name contains '${filter.replace("'", "\\'")}'`);
	}
	query.push(`mimeType != '${DRIVE.FOLDER}'`);
	const res = await googleApiRequest.call(this, 'GET', '/drive/v3/files', undefined, {
		q: query.join(' and '),
		pageToken: paginationToken,
		fields: 'nextPageToken,files(id,name,mimeType,webViewLink)',
		orderBy: 'name_natural',
	});
	return {
		results: res.files.map((i: GoogleDriveFilesItem) => ({
			name: i.name,
			value: i.id,
			url: i.webViewLink,
		})),
		paginationToken: res.nextPageToken,
	};
}

export async function folderSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const query: string[] = [];
	if (filter) {
		query.push(`name contains '${filter.replace("'", "\\'")}'`);
	}
	query.push(`mimeType = '${DRIVE.FOLDER}'`);
	const res = await googleApiRequest.call(this, 'GET', '/drive/v3/files', undefined, {
		q: query.join(' and '),
		pageToken: paginationToken,
		fields: 'nextPageToken,files(id,name,mimeType,webViewLink)',
		orderBy: 'name_natural',
	});

	const results: INodeListSearchItems[] = [
		{
			name: RLC_FOLDER_DEFAULT,
			value: RLC_FOLDER_DEFAULT,
			url: 'https://drive.google.com/drive',
		},
	];

	res.files.forEach((i: GoogleDriveFilesItem) => {
		results.push({
			name: i.name,
			value: i.id,
			url: i.webViewLink,
		});
	});

	return {
		results,
		paginationToken: res.nextPageToken,
	};
}

export async function driveSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	let res = { drives: [], nextPageToken: undefined };

	res = await googleApiRequest.call(this, 'GET', '/drive/v3/drives', undefined, {
		q: filter ? `name contains '${filter.replace("'", "\\'")}'` : undefined,
		pageToken: paginationToken,
	});

	const results: INodeListSearchItems[] = [];

	res.drives.forEach((drive: GoogleDriveDriveItem) => {
		results.push({
			name: drive.name,
			value: drive.id,
			url: `https://drive.google.com/drive/folders/${drive.id}`,
		});
	});

	return {
		results,
		paginationToken: res.nextPageToken,
	};
}

export async function driveSearchWithDefault(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const drives = await driveSearch.call(this, filter, paginationToken);

	const results: INodeListSearchItems[] = [
		{
			name: RLC_DRIVE_DEFAULT,
			value: RLC_DRIVE_DEFAULT,
			url: 'https://drive.google.com/drive/my-drive',
		},
		...drives.results,
	];

	return {
		results,
		paginationToken: drives.paginationToken,
	};
}
