import {
	IHookFunctions,
	IWebhookFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

import {
	wufooApiRequest
} from './GenericFunctions';

import {
	IField,
	IFormQuery,
	IWebhook,
} from './Interface';

import {
	randomBytes,
} from 'crypto';

export class WufooTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Wufoo Trigger',
		name: 'wufooTrigger',
		icon: 'file:wufoo.png',
		group: ['trigger'],
		version: 1,
		description: 'Handle Wufoo events via webhooks',
		defaults: {
			name: 'Wufoo Trigger',
			color: '#c35948',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'wufooApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Forms',
				name: 'form',
				type: 'options',
				required: true,
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getForms',
				},
				description: 'The form upon which will trigger this node when a new entry is made.',
			},
			{
				displayName: 'RAW Data',
				name: 'rawData',
				type: 'boolean',
				default: false,
				description: 'If set to true, the Webhook will include form/field structure data. If false, only form entries will be provided.',
			}
		],

	};

	methods = {
		loadOptions: {
			async getForms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const body : IFormQuery = {includeTodayCount: true};
				// https://wufoo.github.io/docs/#all-forms
				const formObject = await wufooApiRequest.call(this, 'GET', 'forms.json', body);
				for (const form of formObject.Forms) {
					const name = form.Name;
					const hash = form.Hash;
					returnData.push({
						name,
						value: hash,
					});
				}
				// Entries submitted on the same day are present in separate property in data object
				if (formObject.EntryCountToday) {
					for (const form of formObject.EntryCountToday) {
						const name = form.Name;
						const hash = form.Hash;
						returnData.push({
							name,
							value: hash,
						});
					}
				}
				return returnData;
			},
		},
	};

	// @ts-ignore
	webhookMethods = {
		default: {
			// No API endpoint to allow checking of existing webhooks.
			// Creating new webhook will not overwrite existing one if parameters are the same.
			// Otherwise an update occurs.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const formHash = this.getNodeParameter('form') as IDataObject;
				const metadata = this.getNodeParameter('rawData') as boolean;
				const endpoint = `forms/${formHash}/webhooks.json`;

				// Handshake key for webhook endpoint protection
				webhookData.handshakeKey = randomBytes(20).toString('hex') as string;
				const body: IWebhook = {
					url: webhookUrl as string,
					handshakeKey: webhookData.handshakeKey as string,
					metadata
				};

				const result = await wufooApiRequest.call(this, 'PUT', endpoint, body);
				webhookData.webhookId = result.WebHookPutResult.Hash;

				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const formHash = this.getNodeParameter('form') as IDataObject;
				const endpoint = `forms/${formHash}/webhooks/${webhookData.webhookId}.json`;
				try {
					await wufooApiRequest.call(this, 'DELETE', endpoint);
				} catch(error) {
					return false;
				}
				delete webhookData.webhookId;
				delete webhookData.handshakeKey;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const webhookData = this.getWorkflowStaticData('node');
		const metadata = this.getNodeParameter('rawData') as boolean;
		const entries : IDataObject = {};
		let returnObject : IDataObject = {};

		if (req.body.HandshakeKey !== webhookData.handshakeKey) {
			return {};
		}

		const fieldsObject = JSON.parse(req.body.FieldStructure);
		fieldsObject.Fields.map((field : IField) => {
			entries[field.Title] = req.body[field.ID];
		});

		if (metadata) {
			returnObject = {
				createdBy: req.body.CreatedBy as string,
				entryId: req.body.EntryId as number,
				dateCreated: req.body.DateCreated as Date,
				formId: req.body.FormId as string,
				formStructure: JSON.parse(req.body.FormStructure),
				fieldStructure: JSON.parse(req.body.FieldStructure),
				entries
			};

			return {
				workflowData: [
					this.helpers.returnJsonArray([returnObject as unknown as IDataObject]),
				],
			};

		} else {
			return {
				workflowData: [
					this.helpers.returnJsonArray(entries as unknown as IDataObject),
				],
			};
		}
	}
}
