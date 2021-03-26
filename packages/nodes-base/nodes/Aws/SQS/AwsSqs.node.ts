import {
	BINARY_ENCODING,
	IExecuteFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeParameters,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import {
	URL,
} from 'url';

import {
	awsApiRequestSOAP,
} from '../GenericFunctions';

export class AwsSqs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS',
		name: 'awsSqs',
		icon: 'file:sqs.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["queue"]}}',
		description: 'Sends messages to AWS SQS',
		defaults: {
			name: 'AWS SQS',
			color: '#FF9900',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'aws',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Send message',
						value: 'SendMessage',
						description: 'Send a message to a queue.',
					},
				],
				default: 'SendMessage',
				description: 'The operation to perform.',
			},
			{
				displayName: 'Queue',
				name: 'queue',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getQueues',
				},
				displayOptions: {
					show: {
						operation: [
							'SendMessage',
						],
					},
				},
				options: [],
				default: '',
				required: true,
				description: 'Queue to send a message to.',
			},
			{
				displayName: 'Send Input Data',
				name: 'sendInputData',
				type: 'boolean',
				default: true,
				description: 'Send the data the node receives as JSON to SQS.',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				displayOptions: {
					show: {
						operation: [
							'SendMessage',
						],
						sendInputData: [
							false,
						],
					},
				},
				required: true,
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
				description: 'Message to send to the queue.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: {
					show: {
						operation: [
							'SendMessage',
						],
					},
				},
				default: {},
				placeholder: 'Add Option',
				options: [
					{
						displayName: 'Delay Seconds',
						name: 'delaySeconds',
						type: 'number',
						description: 'How long, in seconds, to delay a message for.',
						default: 0,
						typeOptions: {
							minValue: 0,
							maxValue: 900,
						},
					},
					{
						displayName: 'Message Attributes',
						name: 'messageAttributes',
						placeholder: 'Add Attribute',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						description: 'Attributes to set.',
						default: {},
						options: [
							{
								name: 'binary',
								displayName: 'Binary',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name of the attribute.',
									},
									{
										displayName: 'Property Name',
										name: 'dataPropertyName',
										type: 'string',
										default: 'data',
										description: 'Name of the binary property which contains the data for the message attribute.',
									},
								],
							},
							{
								name: 'number',
								displayName: 'Number',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name of the attribute.',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'number',
										default: 0,
										description: 'Number value of the attribute.',
									},
								],
							},
							{
								name: 'string',
								displayName: 'String',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name of the attribute.',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'String value of attribute.',
									},
								],
							},
						],
					},
					{
						displayName: 'Message Deduplication ID',
						name: 'messageDeduplicationId',
						type: 'string',
						default: '',
						description: 'Token used for deduplication of sent messages. Applies only to FIFO (first-in-first-out) queues.',
					},
					{
						displayName: 'Message Group ID',
						name: 'messageGroupId',
						type: 'string',
						default: '',
						description: 'Tag that specifies that a message belongs to a specific message group. Applies only to FIFO (first-in-first-out) queues.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			// Get all the available queues to display them to user so that it can be selected easily
			async getQueues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				let data;
				try {
					// loads first 1000 queues from SQS
					data = await awsApiRequestSOAP.call(this, 'sqs', 'GET', `?Action=ListQueues`);
				} catch (err) {
					throw new Error(`AWS Error: ${err}`);
				}

				let queues = data.ListQueuesResponse.ListQueuesResult.QueueUrl;
				if (!queues) {
					return [];
				}

				if (!Array.isArray(queues)) {
					// If user has only a single queue no array get returned so we make
					// one manually to be able to process everything identically
					queues = [queues];
				}

				return queues.map((queueUrl: string) => {
					const urlParts = queueUrl.split('/');
					const name = urlParts[urlParts.length - 1];

					return {
						name,
						value: queueUrl
					}
				});
			},
		},
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			const queueUrl = this.getNodeParameter('queue', i) as string;
			const queuePath = new URL(queueUrl).pathname;
			const params = [];

			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const sendInputData = this.getNodeParameter('sendInputData', i) as boolean;

			const message = sendInputData ? JSON.stringify(items[i].json) : this.getNodeParameter('message', i) as string;
			params.push(`MessageBody=${message}`);

			if (options.delaySeconds) {
				params.push(`DelaySeconds=${options.delaySeconds}`);
			}

			if (options.messageDeduplicationId) {
				params.push(`MessageDeduplicationId=${options.messageDeduplicationId}`);
			}

			if (options.messageGroupId) {
				params.push(`MessageGroupId=${options.messageGroupId}`);
			}

			let attributeCount = 0;
			// Add string values
			(this.getNodeParameter('options.messageAttributes.string', i, []) as INodeParameters[]).forEach((attribute) => {
				attributeCount++;
				params.push(`MessageAttribute.${attributeCount}.Name=${attribute.name}`);
				params.push(`MessageAttribute.${attributeCount}.Value.StringValue=${attribute.value}`);
				params.push(`MessageAttribute.${attributeCount}.Value.DataType=String`);
			});

			// Add binary values
			(this.getNodeParameter('options.messageAttributes.binary', i, []) as INodeParameters[]).forEach((attribute) => {
				attributeCount++;
				const dataPropertyName = attribute.dataPropertyName as string;
				const item = items[i];

				if (item.binary === undefined) {
					throw new Error('No binary data set. So message attribute cannot be added!');
				}

				if (item.binary[dataPropertyName] === undefined) {
					throw new Error(`The binary property "${dataPropertyName}" does not exist. So message attribute cannot be added!`);
				}

				const binaryData = Buffer.from(item.binary[dataPropertyName].data, BINARY_ENCODING);

				params.push(`MessageAttribute.${attributeCount}.Name=${attribute.name}`);
				params.push(`MessageAttribute.${attributeCount}.Value.BinaryValue=${binaryData}`);
				params.push(`MessageAttribute.${attributeCount}.Value.DataType=Binary`);
			});

			// Add number values
			(this.getNodeParameter('options.messageAttributes.number', i, []) as INodeParameters[]).forEach((attribute) => {
				attributeCount++;
				params.push(`MessageAttribute.${attributeCount}.Name=${attribute.name}`);
				params.push(`MessageAttribute.${attributeCount}.Value.StringValue=${attribute.value}`);
				params.push(`MessageAttribute.${attributeCount}.Value.DataType=Number`);
			});

			let responseData;
			try {
				responseData = await awsApiRequestSOAP.call(this, 'sqs', 'GET', `${queuePath}/?Action=${operation}&` + params.join('&'));
			} catch (err) {
				throw new Error(`AWS Error: ${err}`);
			}

			const result = responseData.SendMessageResponse.SendMessageResult;
			returnData.push(result as IDataObject);
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
