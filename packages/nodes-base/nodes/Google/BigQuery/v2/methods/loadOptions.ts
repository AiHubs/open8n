import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { googleApiRequest } from '../transport';

export async function getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const returnData: INodePropertyOptions[] = [];
	const { projects } = await googleApiRequest.call(this, 'GET', '/v2/projects');
	for (const project of projects) {
		returnData.push({
			name: project.friendlyName as string,
			value: project.id,
		});
	}
	return returnData;
}

export async function getDatasets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const projectId = this.getCurrentNodeParameter('projectId');
	const returnData: INodePropertyOptions[] = [];
	const { datasets } = await googleApiRequest.call(
		this,
		'GET',
		`/v2/projects/${projectId}/datasets`,
	);
	for (const dataset of datasets) {
		returnData.push({
			name: dataset.datasetReference.datasetId as string,
			value: dataset.datasetReference.datasetId,
		});
	}
	return returnData;
}

export async function getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const projectId = this.getCurrentNodeParameter('projectId');
	const datasetId = this.getCurrentNodeParameter('datasetId');
	const returnData: INodePropertyOptions[] = [];
	const { tables } = await googleApiRequest.call(
		this,
		'GET',
		`/v2/projects/${projectId}/datasets/${datasetId}/tables`,
	);
	for (const table of tables) {
		returnData.push({
			name: table.tableReference.tableId as string,
			value: table.tableReference.tableId,
		});
	}
	return returnData;
}
