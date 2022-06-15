import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	IBinaryData,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import {
	apiRequest,
	apiRequestAllItems,
	downloadRecordAttachments,
} from './GenericFunctions';

import {
	operationFields
} from './OperationDescription';

export class NocoDB implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NocoDB',
		name: 'nocoDb',
		icon: 'file:nocodb.svg',
		group: ['input'],
		version: [1, 2],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read, update, write and delete data from NocoDB',
		defaults: {
			name: 'NocoDB',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'nocoDb',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'API Version',
				name: 'version',
				type: 'options',
				displayOptions: {
					show: {
						'@version': [
							1,
						],
					},
				},
				isNodeSetting: true,
				options: [
					{
						name: 'Before v0.90.0',
						value: 1,
					},
					{
						name: 'v0.90.0 Onwards',
						value: 1,
					},
				],
				default: 1,
			},
			{
				displayName: 'API Version',
				name: 'version',
				type: 'options',
				displayOptions: {
					show: {
						'@version': [
							2,
						],
					},
				},
				isNodeSetting: true,
				options: [
					{
						name: 'Before v0.90.0',
						value: 1,
					},
					{
						name: 'v0.90.0 Onwards',
						value: 2,
					},
				],
				default: 2,
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Row',
						value: 'row',
					},
				],
				default: 'row',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [
							'row',
						],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a row',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a row',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Retrieve a row',
					},
					{
						name: 'Get All',
						value: 'getAll',
						description: 'Retrieve all rows',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a row',
					},
				],
				default: 'get',
			},
			...operationFields,
		],
	};

	methods = {
		loadOptions: {
			async getProjects(this: ILoadOptionsFunctions) {
				const credentials = await this.getCredentials('nocoDb');
				if (credentials === undefined) {
					throw new NodeOperationError(this.getNode(), 'No credentials got returned!');
				}

				try {
					const requestMethod = 'GET';
					const endpoint = '/api/v1/db/meta/projects/';
					const responseData = await apiRequest.call(this, requestMethod, endpoint, {}, {});
					return responseData.list.map((i: IDataObject) => ({ name: i.title, value: JSON.stringify(i) }));
				} catch (e) {
					throw new NodeOperationError(this.getNode(), `Error while fetching projects! (${e})`);
				}

			},
			async getTables(this: ILoadOptionsFunctions) {
				const project = JSON.parse(this.getNodeParameter('project', 0) as string || 'null') as IDataObject;
				if (project) {
					const projectId = project.id;
					try {
						const requestMethod = 'GET';
						const endpoint = `/api/v1/db/meta/projects/${projectId}/tables`;
						const responseData = await apiRequest.call(this, requestMethod, endpoint, {}, {});
						return responseData.list.map((i: IDataObject) => ({ name: i.title, value: JSON.stringify(i) }));
					} catch (e) {
						throw new NodeOperationError(this.getNode(), `Error while fetching tables! (${e})`);
					}
				} else {
					throw new NodeOperationError(this.getNode(), `No project selected!`);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		let responseData;

		const version = this.getNode().typeVersion as number;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let returnAll = false;
		let requestMethod = '';

		let qs: IDataObject = {};

		let projectId: string = '';
		let table: string = '';
		let endPoint: string = '';

		if (version === 1) {
			projectId = this.getNodeParameter('projectId', 0) as string;
			table = this.getNodeParameter('table', 0) as string;
		} else if (version === 2) {
			const projectParam = JSON.parse(this.getNodeParameter('project', 0) as string || 'null') as IDataObject;
			const tableParam = JSON.parse(this.getNodeParameter('table', 0) as string || 'null') as IDataObject;

			projectId = projectParam.title as string;
			table = tableParam.title as string;
		}

		if (resource === 'row') {
			if (operation === 'create') {
				requestMethod = 'POST';

				if (version === 1) {
					endPoint = `/nc/${projectId}/api/v1/${table}/bulk`;
				} else if (version === 2) {
					endPoint =  `/api/v1/db/data/bulk/noco/${projectId}/${table}`;
				}

				const body: IDataObject[] = [];

				for (let i = 0; i < items.length; i++) {
					const newItem: IDataObject = {};
					const dataToSend = this.getNodeParameter('dataToSend', i) as 'defineBelow' | 'autoMapInputData';

					if (dataToSend === 'autoMapInputData') {
						const incomingKeys = Object.keys(items[i].json);
						const rawInputsToIgnore = this.getNodeParameter('inputsToIgnore', i) as string;
						const inputDataToIgnore = rawInputsToIgnore.split(',').map(c => c.trim());
						for (const key of incomingKeys) {
							if (inputDataToIgnore.includes(key)) continue;
							newItem[key] = items[i].json[key];
						}
					} else {
						const fields = this.getNodeParameter('fieldsUi.fieldValues', i, []) as Array<{
							fieldName: string;
							binaryData: boolean;
							fieldValue?: string;
							binaryProperty?: string;
						}>;

						for (const field of fields) {
							if (!field.binaryData) {
								newItem[field.fieldName] = field.fieldValue;
							} else if (field.binaryProperty) {
								if (!items[i].binary) {
									throw new NodeOperationError(this.getNode(), 'No binary data exists on item!');
								}
								const binaryPropertyName = field.binaryProperty;
								if (binaryPropertyName && !items[i].binary![binaryPropertyName]) {
									throw new NodeOperationError(this.getNode(), `Binary property ${binaryPropertyName} does not exist on item!`);
								}
								const binaryData = items[i].binary![binaryPropertyName] as IBinaryData;
								const dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

								const formData = {
									file: {
										value: dataBuffer,
										options: {
											filename: binaryData.fileName,
											contentType: binaryData.mimeType,
										},
									},
									json: JSON.stringify({
										api: 'xcAttachmentUpload',
										project_id: projectId,
										dbAlias: 'db',
										args: {},
									}),
								};
								const qs = { project_id: projectId };

								let postUrl: string = '';
								if (version === 1) {
									postUrl = '/dashboard';
								} else if (version === 2) {
									postUrl = '/api/v1/db/storage/upload';
								}

								responseData = await apiRequest.call(this, 'POST', postUrl, {}, qs, undefined, { formData });
								newItem[field.fieldName] = JSON.stringify([responseData]);
							}
						}
					}
					body.push(newItem);
				}
				try {
					responseData = await apiRequest.call(this, requestMethod, endPoint, body, qs);

					// Calculate ID manually and add to return data
					let id = responseData[0];
					for (let i = body.length - 1; i >= 0; i--) {
						body[i].id = id--;
					}

					returnData.push(...body);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ error: error.toString() });
					}
					throw new NodeApiError(this.getNode(), error);
				}

			}

			if (operation === 'delete') {
				requestMethod = 'DELETE';
				if (version === 1) {
					endPoint = `/nc/${projectId}/api/v1/${table}/bulk`;
				} else if (version === 2) {
					endPoint = `/api/v1/db/data/bulk/noco/${projectId}/${table}`;
				}

				const body: IDataObject[] = [];

				for (let i = 0; i < items.length; i++) {
					const id = this.getNodeParameter('id', i) as string;
					body.push({ id });
				}

				try {
					responseData = await apiRequest.call(this, requestMethod, endPoint, body, qs);
					returnData.push(...items.map(item => item.json));
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ error: error.toString() });
					}
					throw new NodeApiError(this.getNode(), error);
				}
			}

			if (operation === 'getAll') {
				const data = [];
				const downloadAttachments = this.getNodeParameter('downloadAttachments', 0) as boolean;
				try {
					for (let i = 0; i < items.length; i++) {
						requestMethod = 'GET';

						if (version === 1) {
							endPoint = `/nc/${projectId}/api/v1/${table}`;
						} else if (version === 2 ) {
							endPoint = `/api/v1/db/data/noco/${projectId}/${table}`;
						}

						returnAll = this.getNodeParameter('returnAll', 0) as boolean;
						qs = this.getNodeParameter('options', i, {}) as IDataObject;

						if (qs.sort) {
							const properties = (qs.sort as IDataObject).property as Array<{ field: string, direction: string }>;
							qs.sort = properties.map(prop => `${prop.direction === 'asc' ? '' : '-'}${prop.field}`).join(',');
						}

						if (qs.fields) {
							qs.fields = (qs.fields as IDataObject[]).join(',');
						}

						if (returnAll === true) {
							responseData = await apiRequestAllItems.call(this, requestMethod, endPoint, {}, qs);
						} else {
							qs.limit = this.getNodeParameter('limit', 0) as number;
							responseData = await apiRequest.call(this, requestMethod, endPoint, {}, qs);
						}

						returnData.push.apply(returnData, responseData);

						if (downloadAttachments === true) {
							const downloadFieldNames = (this.getNodeParameter('downloadFieldNames', 0) as string).split(',');
							const response = await downloadRecordAttachments.call(this, responseData, downloadFieldNames);
							data.push(...response);
						}
					}

					if (downloadAttachments) {
						return [data];
					}

				 } catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ error: error.toString() });
					}
					throw error;
				}
			}

			if (operation === 'get') {
				requestMethod = 'GET';
				const newItems: INodeExecutionData[] = [];

				for (let i = 0; i < items.length; i++) {
					try {
						const id = this.getNodeParameter('id', i) as string;

						if (version === 1) {
							endPoint = `/nc/${projectId}/api/v1/${table}/${id}`;
						}	else if (version === 2) {
							endPoint = `/api/v1/db/data/noco/${projectId}/${table}/${id}`;
						}

						responseData = await apiRequest.call(this, requestMethod, endPoint, {}, qs);
						const newItem: INodeExecutionData = { json: responseData };
						const downloadAttachments = this.getNodeParameter('downloadAttachments', i) as boolean;

						if (downloadAttachments === true) {
							const downloadFieldNames = (this.getNodeParameter('downloadFieldNames', i) as string).split(',');
							const data = await downloadRecordAttachments.call(this, [responseData], downloadFieldNames);
							newItem.binary = data[0].binary;
						}

						newItems.push(newItem);
					} catch (error) {
						if (this.continueOnFail()) {
							newItems.push({ json: { error: error.toString() } });
							continue;
						}
						throw new NodeApiError(this.getNode(), error);
					}
				}
				return this.prepareOutputData(newItems);
			}

			if (operation === 'update') {

				let requestMethod: string = 'PATCH';

				if (version === 1) {
					endPoint = `/nc/${projectId}/api/v1/${table}/bulk`;
					requestMethod = 'PUT';
				} else if (version === 2) {
					endPoint = `/api/v1/db/data/bulk/noco/${projectId}/${table}`;
				}
				const body: IDataObject[] = [];

				for (let i = 0; i < items.length; i++) {

					const id = this.getNodeParameter('id', i) as string;
					const newItem: IDataObject = { id };
					const dataToSend = this.getNodeParameter('dataToSend', i) as 'defineBelow' | 'autoMapInputData';

					if (dataToSend === 'autoMapInputData') {
						const incomingKeys = Object.keys(items[i].json);
						const rawInputsToIgnore = this.getNodeParameter('inputsToIgnore', i) as string;
						const inputDataToIgnore = rawInputsToIgnore.split(',').map(c => c.trim());
						for (const key of incomingKeys) {
							if (inputDataToIgnore.includes(key)) continue;
							newItem[key] = items[i].json[key];
						}
					} else {
						const fields = this.getNodeParameter('fieldsUi.fieldValues', i, []) as Array<{
							fieldName: string;
							binaryData: boolean;
							fieldValue?: string;
							binaryProperty?: string;
						}>;

						for (const field of fields) {
							if (!field.binaryData) {
								newItem[field.fieldName] = field.fieldValue;
							} else if (field.binaryProperty) {
								if (!items[i].binary) {
									throw new NodeOperationError(this.getNode(), 'No binary data exists on item!');
								}
								const binaryPropertyName = field.binaryProperty;
								if (binaryPropertyName && !items[i].binary![binaryPropertyName]) {
									throw new NodeOperationError(this.getNode(), `Binary property ${binaryPropertyName} does not exist on item!`);
								}
								const binaryData = items[i].binary![binaryPropertyName] as IBinaryData;
								const dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

								const formData = {
									file: {
										value: dataBuffer,
										options: {
											filename: binaryData.fileName,
											contentType: binaryData.mimeType,
										},
									},
									json: JSON.stringify({
										api: 'xcAttachmentUpload',
										project_id: projectId,
										dbAlias: 'db',
										args: {},
									}),
								};
								const qs = { project_id: projectId };
								let postUrl: string = '';
								if (version === 1) {
									postUrl = '/dashboard';
								} else if (version === 2) {
									postUrl = '/api/v1/db/storage/upload';
								}
								responseData = await apiRequest.call(this, 'POST', postUrl, {}, qs, undefined, { formData });
								newItem[field.fieldName] = JSON.stringify([responseData]);
							}
						}
					}
					body.push(newItem);
				}

				try {
					responseData = await apiRequest.call(this, requestMethod, endPoint, body, qs);
					returnData.push(...body);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ error: error.toString() });
					}
					throw new NodeApiError(this.getNode(), error);
				}
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
