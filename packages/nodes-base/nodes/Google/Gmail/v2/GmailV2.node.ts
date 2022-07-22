/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	IBinaryKeyData,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {
	buildQuery,
	encodeEmail,
	extractEmail,
	googleApiRequest,
	googleApiRequestAllItems,
	IEmail,
	parseRawEmail,
} from '../GenericFunctions';

import {
	messageFields,
	messageOperations,
} from './MessageDescription';

import {
	labelFields,
	labelOperations,
} from './LabelDescription';

import {
	draftFields,
	draftOperations,
} from './DraftDescription';

import {
	threadFields,
	threadOperations,
} from './ThreadDescription';

import {
	isEmpty,
} from 'lodash';

import {
	DateTime,
} from 'luxon';

const versionDescription: INodeTypeDescription = {
	displayName: 'Gmail',
	name: 'gmail',
	icon: 'file:gmail.svg',
	group: ['transform'],
	version: 2,
	subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
	description: 'Consume the Gmail API',
	defaults: {
		name: 'Gmail',
	},
	inputs: ['main'],
	outputs: ['main'],
	credentials: [
		{
			name: 'googleApi',
			required: true,
			displayOptions: {
				show: {
					authentication: [
						'serviceAccount',
					],
				},
			},
		},
		{
			name: 'gmailOAuth2',
			required: true,
			displayOptions: {
				show: {
					authentication: [
						'oAuth2',
					],
				},
			},
		},
	],
	properties: [
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'options',
			options: [
				{
					name: 'OAuth2 (Recommended)',
					value: 'oAuth2',
				},
				{
					name: 'Service Account',
					value: 'serviceAccount',
				},
			],
			default: 'oAuth2',
		},
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'Message',
					value: 'message',
				},
				{
					name: 'Thread',
					value: 'thread',
				},
				{
					name: 'Label',
					value: 'label',
				},
				{
					name: 'Draft',
					value: 'draft',
				},
			],
			default: 'draft',
		},
		//-------------------------------
		// Draft Operations
		//-------------------------------
		...draftOperations,
		...draftFields,
		//-------------------------------
		// Label Operations
		//-------------------------------
		...labelOperations,
		...labelFields,
		//-------------------------------
		// Message Operations
		//-------------------------------
		...messageOperations,
		...messageFields,
		//-------------------------------
		// Thread Operations
		//-------------------------------
		...threadOperations,
		...threadFields,
		//-------------------------------
	],
};

export class GmailV2 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			...versionDescription,
		};
	}

	methods = {
		loadOptions: {
			// Get all the labels to display them to user so that he can
			// select them easily
			async getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				const labels = await googleApiRequestAllItems.call(
					this,
					'labels',
					'GET',
					'/gmail/v1/users/me/labels',
				);

				for (const label of labels) {
					returnData.push({
						name: label.name,
						value: label.id,
					});
				}

				return returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});
			},

			async getThreadMessages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				const id = this.getNodeParameter('threadId', 0) as string;
				const {messages} = await googleApiRequest.call(this, 'GET', `/gmail/v1/users/me/threads/${id}`, {}, { format: 'minimal' });

				for (const message of messages || []) {
					returnData.push({
						name: message.snippet,
						value: message.id,
					});
				}

				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let method = '';
		let body: IDataObject = {};
		let qs: IDataObject = {};
		let endpoint = '';
		let responseData;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'label') {
					if (operation === 'create') {
						//https://developers.google.com/gmail/api/v1/reference/users/labels/create
						const labelName = this.getNodeParameter('name', i) as string;
						const labelListVisibility = this.getNodeParameter('labelListVisibility', i) as string;
						const messageListVisibility = this.getNodeParameter('messageListVisibility', i) as string;

						method = 'POST';
						endpoint = '/gmail/v1/users/me/labels';

						body = {
							labelListVisibility,
							messageListVisibility,
							name: labelName,
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					if (operation === 'delete') {
						//https://developers.google.com/gmail/api/v1/reference/users/labels/delete
						const labelId = this.getNodeParameter('labelId', i) as string[];

						method = 'DELETE';
						endpoint = `/gmail/v1/users/me/labels/${labelId}`;
						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
						responseData = { success: true };

					}
					if (operation === 'get') {
						// https://developers.google.com/gmail/api/v1/reference/users/labels/get
						const labelId = this.getNodeParameter('labelId', i);

						method = 'GET';
						endpoint = `/gmail/v1/users/me/labels/${labelId}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;

						responseData = await googleApiRequest.call(
							this,
							'GET',
							`/gmail/v1/users/me/labels`,
							{},
							qs,
						);

						responseData = responseData.labels;

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = responseData.splice(0, limit);
						}
					}
					if (operation === 'addLabels') {
						const id = this.getNodeParameter('resourceId', i);
						const labelIds = this.getNodeParameter('labelIds', i) as string[];
						const resourceAPI = this.getNodeParameter('operateOn', i) as string;

						method = 'POST';
						endpoint = `/gmail/v1/users/me/${resourceAPI}/${id}/modify`;

						body = {
							addLabelIds: labelIds,
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					if (operation === 'removeLabels') {
						const id = this.getNodeParameter('resourceId', i);
						const labelIds = this.getNodeParameter('labelIds', i) as string[];
						const resourceAPI = this.getNodeParameter('operateOn', i) as string;

						method = 'POST';
						endpoint = `/gmail/v1/users/me/${resourceAPI}/${id}/modify`;

						body = {
							removeLabelIds: labelIds,
						};
						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
				}
				if (resource === 'message') {
					if (operation === 'send') {
						// https://developers.google.com/gmail/api/v1/reference/users/messages/send

						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						let toStr = '';
						let ccStr = '';
						let bccStr = '';
						let attachmentsList: IDataObject[] = [];

						const sendTo = this.getNodeParameter('sendTo', i) as string;

						sendTo.split(',').forEach(entry => {
							const email = entry.trim();

							if (email.indexOf('@') === -1) {
								throw new NodeOperationError(this.getNode(), `Email address ${email} inside "Send To" input field is not valid`, { itemIndex: i });
							}

							toStr += `<${email}>, `;
						});

						if (additionalFields.ccList) {
							const ccList = additionalFields.ccList as IDataObject[];

							ccList.forEach((email) => {
								ccStr += `<${email}>, `;
							});
						}

						if (additionalFields.bccList) {
							const bccList = additionalFields.bccList as IDataObject[];

							bccList.forEach((email) => {
								bccStr += `<${email}>, `;
							});
						}

						if (additionalFields.attachmentsUi) {
							const attachmentsUi = additionalFields.attachmentsUi as IDataObject;
							const attachmentsBinary = [];
							if (!isEmpty(attachmentsUi)) {
								if (attachmentsUi.hasOwnProperty('attachmentsBinary')
									&& !isEmpty(attachmentsUi.attachmentsBinary)
									&& items[i].binary) {
									// @ts-ignore
									for (const { property } of attachmentsUi.attachmentsBinary as IDataObject[]) {
										for (const binaryProperty of (property as string).split(',')) {
											if (items[i].binary![binaryProperty] !== undefined) {
												const binaryData = items[i].binary![binaryProperty];
												const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
												attachmentsBinary.push({
													name: binaryData.fileName || 'unknown',
													content: binaryDataBuffer,
													type: binaryData.mimeType,
												});
											}
										}
									}
								}

								qs = {
									userId: 'me',
									uploadType: 'media',
								};
								attachmentsList = attachmentsBinary;
							}
						}

						let from = '';
						if (additionalFields.senderName) {
							const {emailAddress} = await googleApiRequest.call(this, 'GET', '/gmail/v1/users/me/profile');
							from = `${additionalFields.senderName as string} <${emailAddress}>`;
						}


						const emailType = this.getNodeParameter('emailType', i) as string;

						let messageBody = '';
						let messageBodyHtml = '';

						if (emailType === 'html') {
							messageBodyHtml = this.getNodeParameter('message', i) as string;
						} else {
							messageBody = this.getNodeParameter('message', i) as string;
						}


						const email: IEmail = {
							from,
							to: toStr,
							cc: ccStr,
							bcc: bccStr,
							subject: this.getNodeParameter('subject', i) as string,
							body: messageBody,
							htmlBody: messageBodyHtml,
							attachments: attachmentsList,
						};

						endpoint = '/gmail/v1/users/me/messages/send';
						method = 'POST';

						body = {
							raw: await encodeEmail(email),
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					if (operation === 'reply') {
						const messageIdGmail = this.getNodeParameter('messageId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						let toStr = '';
						let ccStr = '';
						let bccStr = '';
						let attachmentsList: IDataObject[] = [];

						if (additionalFields.ccList) {
							const ccList = additionalFields.ccList as IDataObject[];

							ccList.forEach((email) => {
								ccStr += `<${email}>, `;
							});
						}

						if (additionalFields.bccList) {
							const bccList = additionalFields.bccList as IDataObject[];

							bccList.forEach((email) => {
								bccStr += `<${email}>, `;
							});
						}

						if (additionalFields.attachmentsUi) {
							const attachmentsUi = additionalFields.attachmentsUi as IDataObject;
							const attachmentsBinary = [];
							if (!isEmpty(attachmentsUi)) {
								if (attachmentsUi.hasOwnProperty('attachmentsBinary')
									&& !isEmpty(attachmentsUi.attachmentsBinary)
									&& items[i].binary) {
									// @ts-ignore
									for (const { property } of attachmentsUi.attachmentsBinary as IDataObject[]) {
										for (const binaryProperty of (property as string).split(',')) {
											if (items[i].binary![binaryProperty] !== undefined) {
												const binaryData = items[i].binary![binaryProperty];
												const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
												attachmentsBinary.push({
													name: binaryData.fileName || 'unknown',
													content: binaryDataBuffer,
													type: binaryData.mimeType,
												});
											}
										}
									}
								}

								qs = {
									userId: 'me',
									uploadType: 'media',
								};
								attachmentsList = attachmentsBinary;
							}
						}

						endpoint = `/gmail/v1/users/me/messages/${messageIdGmail}`;

						qs.format = 'metadata';

						const { payload, threadId } = await googleApiRequest.call(this, method, endpoint, body, qs);

						if (toStr === '') {
							for (const header of payload.headers as IDataObject[]) {
								if (header.name === 'From') {
									toStr = `<${extractEmail(header.value as string)}>,`;
									break;
								}
							}
						}


						if (additionalFields.sendTo) {
							const sendTo = additionalFields.sendTo as string;

							sendTo.split(',').forEach(entry => {
								const email = entry.trim();

								if (email.indexOf('@') === -1) {
									throw new NodeOperationError(this.getNode(), `Email address ${email} inside "Extra to Recipients" option is not valid`, { itemIndex: i });
								}

								toStr += `<${email}>, `;
							});
						}

						const subject = payload.headers.filter((data: { [key: string]: string }) => data.name === 'Subject')[0]?.value  || '';
						// always empty
						// const references = payload.headers.filter((data: { [key: string]: string }) => data.name === 'References')[0]?.value || '';
						const messageIdGlobal = payload.headers.filter((data: { [key: string]: string }) => data.name === 'Message-Id')[0]?.value || '';

						let from = '';
						if (additionalFields.senderName) {
							const {emailAddress} = await googleApiRequest.call(this, 'GET', '/gmail/v1/users/me/profile');
							from = `${additionalFields.senderName as string} <${emailAddress}>`;
						}

						const emailType = this.getNodeParameter('emailType', i) as string;

						let messageBody = '';
						let messageBodyHtml = '';

						if (emailType === 'html') {
							messageBodyHtml = this.getNodeParameter('message', i) as string;
						} else {
							messageBody = this.getNodeParameter('message', i) as string;
						}

						const email: IEmail = {
							from,
							to: toStr,
							cc: ccStr,
							bcc: bccStr,
							subject,
							body: messageBody,
							htmlBody: messageBodyHtml,
							attachments: attachmentsList,
							inReplyTo: messageIdGlobal,
							reference: messageIdGlobal,
						};

						endpoint = '/gmail/v1/users/me/messages/send';
						method = 'POST';

						body = {
							raw: await encodeEmail(email),
							threadId,
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					if (operation === 'get') {
						//https://developers.google.com/gmail/api/v1/reference/users/messages/get
						method = 'GET';

						const id = this.getNodeParameter('messageId', i);

						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const format = additionalFields.format || 'resolved';

						if (format === 'resolved') {
							qs.format = 'raw';
						} else {
							qs.format = format;
						}

						endpoint = `/gmail/v1/users/me/messages/${id}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);

						let nodeExecutionData: INodeExecutionData;
						if (format === 'resolved') {
							const dataPropertyNameDownload = additionalFields.dataPropertyAttachmentsPrefixName as string || 'attachment_';

							nodeExecutionData = await parseRawEmail.call(this, responseData, dataPropertyNameDownload);
						} else {
							nodeExecutionData = {
								json: responseData,
							};
						}

						responseData = nodeExecutionData;
					}
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						Object.assign(qs, buildQuery(additionalFields));

						if (returnAll) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'messages',
								'GET',
								`/gmail/v1/users/me/messages`,
								{},
								qs,
							);
						} else {
							qs.maxResults = this.getNodeParameter('limit', i) as number;
							responseData = await googleApiRequest.call(
								this,
								'GET',
								`/gmail/v1/users/me/messages`,
								{},
								qs,
							);
							responseData = responseData.messages;
						}

						if (responseData === undefined) {
							responseData = [];
						}

						const format = additionalFields.format || 'resolved';

						if (format !== 'ids') {

							if (format === 'resolved') {
								qs.format = 'raw';
							} else {
								qs.format = format;
							}

							for (let i = 0; i < responseData.length; i++) {
								responseData[i] = await googleApiRequest.call(
									this,
									'GET',
									`/gmail/v1/users/me/messages/${responseData[i].id}`,
									body,
									qs,
								);

								if (format === 'resolved') {
									const dataPropertyNameDownload = additionalFields.dataPropertyAttachmentsPrefixName as string || 'attachment_';

									responseData[i] = await parseRawEmail.call(this, responseData[i], dataPropertyNameDownload);
								}
							}
						}

						if (format !== 'resolved') {
							responseData = this.helpers.returnJsonArray(responseData);
						}

					}
					if (operation === 'delete') {
						// https://developers.google.com/gmail/api/v1/reference/users/messages/delete
						method = 'DELETE';
						const id = this.getNodeParameter('messageId', i);

						endpoint = `/gmail/v1/users/me/messages/${id}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);

						responseData = { success: true };
					}
					if (operation === 'markAsRead') {
						// https://developers.google.com/gmail/api/reference/rest/v1/users.messages/modify
						method = 'POST';
						const id = this.getNodeParameter('messageId', i);

						endpoint = `/gmail/v1/users/me/messages/${id}/modify`;

						const body = {
							removeLabelIds: ['UNREAD'],
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body);
					}

					if (operation === 'markAsUnread') {
						// https://developers.google.com/gmail/api/reference/rest/v1/users.messages/modify
						method = 'POST';
						const id = this.getNodeParameter('messageId', i);

						endpoint = `/gmail/v1/users/me/messages/${id}/modify`;

						const body = {
							addLabelIds: ['UNREAD'],
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body);
					}
				}
				if (resource === 'draft') {
					if (operation === 'create') {
						// https://developers.google.com/gmail/api/v1/reference/users/drafts/create

						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						let toStr = '';
						let ccStr = '';
						let bccStr = '';
						let attachmentsList: IDataObject[] = [];

						if (additionalFields.sendTo) {
							(additionalFields.sendTo as string).split(',').forEach(entry => {
								const email = entry.trim();

								if (email.indexOf('@') === -1) {
									throw new NodeOperationError(this.getNode(), `Email address ${email} is not valid`, { itemIndex: i });
								}

								toStr += `<${email}>, `;
							});
						}

						if (additionalFields.ccList) {
							const ccList = additionalFields.ccList as IDataObject[];

							ccList.forEach((email) => {
								ccStr += `<${email}>, `;
							});
						}

						if (additionalFields.bccList) {
							const bccList = additionalFields.bccList as IDataObject[];

							bccList.forEach((email) => {
								bccStr += `<${email}>, `;
							});
						}

						if (additionalFields.attachmentsUi) {
							const attachmentsUi = additionalFields.attachmentsUi as IDataObject;
							const attachmentsBinary = [];
							if (!isEmpty(attachmentsUi)) {
								if (!isEmpty(attachmentsUi)) {
									if (attachmentsUi.hasOwnProperty('attachmentsBinary')
										&& !isEmpty(attachmentsUi.attachmentsBinary)
										&& items[i].binary) {
										for (const { property } of attachmentsUi.attachmentsBinary as IDataObject[]) {
											for (const binaryProperty of (property as string).split(',')) {
												if (items[i].binary![binaryProperty] !== undefined) {
													const binaryData = items[i].binary![binaryProperty];
													const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
													attachmentsBinary.push({
														name: binaryData.fileName || 'unknown',
														content: binaryDataBuffer,
														type: binaryData.mimeType,
													});
												}
											}
										}
									}
								}

								qs = {
									userId: 'me',
									uploadType: 'media',
								};

								attachmentsList = attachmentsBinary;
							}
						}

						const emailType = this.getNodeParameter('emailType', i) as string;

						let messageBody = '';
						let messageBodyHtml = '';

						if (emailType === 'html') {
							messageBodyHtml = this.getNodeParameter('message', i) as string;
						} else {
							messageBody = this.getNodeParameter('message', i) as string;
						}

						const email: IEmail = {
							to: toStr,
							cc: ccStr,
							bcc: bccStr,
							subject: this.getNodeParameter('subject', i) as string,
							body: messageBody,
							htmlBody: messageBodyHtml,
							attachments: attachmentsList,
						};

						endpoint = '/gmail/v1/users/me/drafts';
						method = 'POST';

						body = {
							message: {
								raw: await encodeEmail(email),
							},
						};

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					if (operation === 'get') {
						// https://developers.google.com/gmail/api/v1/reference/users/drafts/get
						method = 'GET';
						const id = this.getNodeParameter('messageId', i);

						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const format = additionalFields.format || 'resolved';

						if (format === 'resolved') {
							qs.format = 'raw';
						} else {
							qs.format = format;
						}

						endpoint = `/gmail/v1/users/me/drafts/${id}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);

						const binaryData: IBinaryKeyData = {};

						let nodeExecutionData: INodeExecutionData;
						if (format === 'resolved') {
							const dataPropertyNameDownload = additionalFields.dataPropertyAttachmentsPrefixName as string || 'attachment_';

							nodeExecutionData = await parseRawEmail.call(this, responseData.message, dataPropertyNameDownload);

							// Add the draft-id
							nodeExecutionData.json.messageId = nodeExecutionData.json.id;
							nodeExecutionData.json.id = responseData.id;
						} else {
							nodeExecutionData = {
								json: responseData,
								binary: Object.keys(binaryData).length ? binaryData : undefined,
							};
						}

						responseData = nodeExecutionData;
					}
					if (operation === 'delete') {
						// https://developers.google.com/gmail/api/v1/reference/users/drafts/delete
						method = 'DELETE';
						const id = this.getNodeParameter('messageId', i);

						endpoint = `/gmail/v1/users/me/drafts/${id}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);

						responseData = { success: true };
					}
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						Object.assign(qs, additionalFields);

						if (returnAll) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'drafts',
								'GET',
								`/gmail/v1/users/me/drafts`,
								{},
								qs,
							);
						} else {
							qs.maxResults = this.getNodeParameter('limit', i) as number;
							responseData = await googleApiRequest.call(
								this,
								'GET',
								`/gmail/v1/users/me/drafts`,
								{},
								qs,
							);
							responseData = responseData.drafts;
						}

						if (responseData === undefined) {
							responseData = [];
						}

						const format = additionalFields.format || 'resolved';

						if (format !== 'ids') {
							if (format === 'resolved') {
								qs.format = 'raw';
							} else {
								qs.format = format;
							}

							for (let i = 0; i < responseData.length; i++) {

								responseData[i] = await googleApiRequest.call(
									this,
									'GET',
									`/gmail/v1/users/me/drafts/${responseData[i].id}`,
									body,
									qs,
								);

								if (format === 'resolved') {
									const dataPropertyNameDownload = additionalFields.dataPropertyAttachmentsPrefixName as string || 'attachment_';
									const id = responseData[i].id;
									responseData[i] = await parseRawEmail.call(this, responseData[i].message, dataPropertyNameDownload);

									// Add the draft-id
									responseData[i].json.messageId = responseData[i].json.id;
									responseData[i].json.id = id;
								}
							}
						}

						if (format !== 'resolved') {
							responseData = this.helpers.returnJsonArray(responseData);
						}
					}
				}
				if (resource === 'thread') {
					if (operation === 'delete') {
						//https://developers.google.com/gmail/api/reference/rest/v1/users.threads/delete
						method = 'DELETE';

						const id = this.getNodeParameter('threadId', i);

						endpoint = `/gmail/v1/users/me/threads/${id}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);

						responseData = { success: true };
					}
					if (operation === 'get') {
						//https://developers.google.com/gmail/api/reference/rest/v1/users.threads/get
						method = 'GET';

						const id = this.getNodeParameter('threadId', i);

						const options = this.getNodeParameter('options', i) as IDataObject;
						const format = options.format || 'minimal';
						const onlyMessages = options.returnOnlyMessages || false;

						qs.format = format;

						endpoint = `/gmail/v1/users/me/threads/${id}`;

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);

						if (onlyMessages) {
							responseData = responseData.messages;
						}
					}
					if (operation === 'getAll') {
						//https://developers.google.com/gmail/api/reference/rest/v1/users.threads/list
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						Object.assign(qs, buildQuery(additionalFields));

						if (returnAll) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'threads',
								'GET',
								`/gmail/v1/users/me/threads`,
								{},
								qs,
							);
						} else {
							qs.maxResults = this.getNodeParameter('limit', i) as number;
							responseData = await googleApiRequest.call(
								this,
								'GET',
								`/gmail/v1/users/me/threads`,
								{},
								qs,
							);
							responseData = responseData.threads;
						}

						if (responseData === undefined) {
							responseData = [];
						}
					}
					//----------------------------------------------------------------------------------------------------------------------
					if (operation === 'reply') {
						const messageIdGmail = this.getNodeParameter('messageId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						let toStr = '';
						let ccStr = '';
						let bccStr = '';
						let attachmentsList: IDataObject[] = [];

						if (additionalFields.ccList) {
							const ccList = additionalFields.ccList as IDataObject[];

							ccList.forEach((email) => {
								ccStr += `<${email}>, `;
							});
						}

						if (additionalFields.bccList) {
							const bccList = additionalFields.bccList as IDataObject[];

							bccList.forEach((email) => {
								bccStr += `<${email}>, `;
							});
						}

						if (additionalFields.attachmentsUi) {
							const attachmentsUi = additionalFields.attachmentsUi as IDataObject;
							const attachmentsBinary = [];
							if (!isEmpty(attachmentsUi)) {
								if (attachmentsUi.hasOwnProperty('attachmentsBinary')
									&& !isEmpty(attachmentsUi.attachmentsBinary)
									&& items[i].binary) {
									// @ts-ignore
									for (const { property } of attachmentsUi.attachmentsBinary as IDataObject[]) {
										for (const binaryProperty of (property as string).split(',')) {
											if (items[i].binary![binaryProperty] !== undefined) {
												const binaryData = items[i].binary![binaryProperty];
												const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
												attachmentsBinary.push({
													name: binaryData.fileName || 'unknown',
													content: binaryDataBuffer,
													type: binaryData.mimeType,
												});
											}
										}
									}
								}

								qs = {
									userId: 'me',
									uploadType: 'media',
								};
								attachmentsList = attachmentsBinary;
							}
						}

						endpoint = `/gmail/v1/users/me/messages/${messageIdGmail}`;

						qs.format = 'metadata';

						const { payload, threadId } = await googleApiRequest.call(this, method, endpoint, body, qs);

						if (toStr === '') {
							for (const header of payload.headers as IDataObject[]) {
								if (header.name === 'From') {
									toStr = `<${extractEmail(header.value as string)}>,`;
									break;
								}
							}
						}

						if (additionalFields.sendTo) {
							const sendTo = additionalFields.sendTo as string;

							sendTo.split(',').forEach(entry => {
								const email = entry.trim();

								if (email.indexOf('@') === -1) {
									throw new NodeOperationError(this.getNode(), `Email address ${email} inside "Extra to Recipients" option is not valid`, { itemIndex: i });
								}

								toStr += `<${email}>, `;
							});
						}

						const subject = payload.headers.filter((data: { [key: string]: string }) => data.name === 'Subject')[0]?.value  || '';
						// always empty
						// const references = payload.headers.filter((data: { [key: string]: string }) => data.name === 'References')[0]?.value || '';
						const messageIdGlobal = payload.headers.filter((data: { [key: string]: string }) => data.name === 'Message-Id')[0]?.value || '';

						let from = '';
						if (additionalFields.senderName) {
							const {emailAddress} = await googleApiRequest.call(this, 'GET', '/gmail/v1/users/me/profile');
							from = `${additionalFields.senderName as string} <${emailAddress}>`;
						}

						const emailType = this.getNodeParameter('emailType', i) as string;

						let messageBody = '';
						let messageBodyHtml = '';

						if (emailType === 'html') {
							messageBodyHtml = this.getNodeParameter('message', i) as string;
						} else {
							messageBody = this.getNodeParameter('message', i) as string;
						}

						const email: IEmail = {
							from,
							to: toStr,
							cc: ccStr,
							bcc: bccStr,
							subject,
							body: messageBody,
							htmlBody: messageBodyHtml,
							attachments: attachmentsList,
							inReplyTo: messageIdGlobal,
							reference: messageIdGlobal,
						};

						body = {
							raw: await encodeEmail(email),
							threadId,
						};

						endpoint = '/gmail/v1/users/me/messages/send';
						method = 'POST';

						responseData = await googleApiRequest.call(this, method, endpoint, body, qs);
					}
					//----------------------------------------------------------------------------------------------------------------------
					if (operation === 'trash') {
						//https://developers.google.com/gmail/api/reference/rest/v1/users.threads/trash
						method = 'POST';

						const id = this.getNodeParameter('threadId', i);

						endpoint = `/gmail/v1/users/me/threads/${id}/trash`;

						responseData = await googleApiRequest.call(this, method, endpoint, {}, qs);
					}
					if (operation === 'untrash') {
						//https://developers.google.com/gmail/api/reference/rest/v1/users.threads/untrash
						method = 'POST';

						const id = this.getNodeParameter('threadId', i);

						endpoint = `/gmail/v1/users/me/threads/${id}/untrash`;

						responseData = await googleApiRequest.call(this, method, endpoint, {}, qs);
					}
				}
				if (Array.isArray(responseData)) {
					returnData.push.apply(returnData, responseData as IDataObject[]);
				} else {
					returnData.push(responseData as IDataObject);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw error;
			}
		}
		if (['draft', 'message'].includes(resource) && ['get', 'getAll'].includes(operation)) {
			//@ts-ignore
			return this.prepareOutputData(returnData);
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
