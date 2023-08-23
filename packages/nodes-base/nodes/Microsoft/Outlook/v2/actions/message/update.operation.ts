import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createMessage } from '../../helpers/utils';
import { microsoftApiRequest } from '../../transport';

export const description: INodeProperties[] = [
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'BCC Recipients',
				name: 'bccRecipients',
				description: 'Comma-separated list of email addresses of BCC recipients',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Category Names or IDs',
				name: 'categories',
				type: 'multiOptions',
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getCategories',
				},
				default: [],
			},
			{
				displayName: 'CC Recipients',
				name: 'ccRecipients',
				description: 'Comma-separated list of email addresses of CC recipients',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Headers',
				name: 'internetMessageHeaders',
				placeholder: 'Add Header',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'headers',
						displayName: 'Header',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the header',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value to set for the header',
							},
						],
					},
				],
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
				displayName: 'Folder',
				name: 'folder',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getFolders',
				},
				default: [],
				description:
					'Only return messages from selected folders. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
			},
			{
				displayName: 'Importance',
				name: 'importance',
				description: 'The importance of the message',
				type: 'options',
				options: [
					{
						name: 'Low',
						value: 'Low',
					},
					{
						name: 'Normal',
						value: 'Normal',
					},
					{
						name: 'High',
						value: 'High',
					},
				],
				default: 'Low',
			},
			{
				displayName: 'Is Read',
				name: 'isRead',
				description: 'Whether the message must be marked as read',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Message',
				name: 'bodyContent',
				description: 'Message body content',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
			},
			{
				displayName: 'Message Type',
				name: 'bodyContentType',
				description: 'Message body content type',
				type: 'options',
				options: [
					{
						name: 'HTML',
						value: 'html',
					},
					{
						name: 'Text',
						value: 'Text',
					},
				],
				default: 'html',
			},
			{
				displayName: 'Read Receipt Requested',
				name: 'isReadReceiptRequested',
				description: 'Whether a read receipt is requested for the message',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'To',
				name: 'toRecipients',
				description: 'Comma-separated list of email addresses of recipients',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Reply To',
				name: 'replyTo',
				description: 'Email address to use when replying',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				description: 'The subject of the message',
				type: 'string',
				default: '',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	let responseData;

	const messageId = this.getNodeParameter('messageId', index) as string;

	const updateFields = this.getNodeParameter('updateFields', index);

	if (updateFields.folder) {
		const body: IDataObject = {
			destinationId: updateFields.folder,
		};

		responseData = await microsoftApiRequest.call(
			this,
			'POST',
			`/messages/${messageId}/move`,
			body,
		);

		delete updateFields.folder;
	}

	const body: IDataObject = createMessage(updateFields);

	if (!Object.keys(body).length) {
		throw new NodeOperationError(this.getNode(), 'No fields to update got specified');
	}

	responseData = await microsoftApiRequest.call(this, 'PATCH', `/messages/${messageId}`, body, {});

	const executionData = this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(responseData as IDataObject),
		{ itemData: { item: index } },
	);

	return executionData;
}
