import {
	INodeProperties,
} from 'n8n-workflow';

export const certificateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		noDataExpression: true,
		type: 'options',
		displayOptions: {
			show: {
				resource: [
					'certificate',
				],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a certificate',
			},
			{
				name: 'Download',
				value: 'download',
				description: 'Download a certificate',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a certificate',
			},
			{
				name: 'Get All',
				value: 'getAll',
				description: 'Retrieve all certificates',
			},
			{
				name: 'Renew',
				value: 'renew',
				description: 'Renew a certificate',
			},
		],
		default: 'delete',
	},
];

export const certificateFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                          certificate:download                              */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Certificate ID',
		name: 'certificateId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Download Item',
		name: 'downloadItem',
		type: 'options',
		options: [
			{
				name: 'Certificate',
				value: 'certificate',
			},
			{
				name: 'Keystore',
				value: 'keystore',
			},
		],
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: 'certificate',
	},
	{
		displayName: 'Keystore Type',
		name: 'keystoreType',
		type: 'options',
		options: [
			{
				name: 'JKS',
				value: 'JKS',
			},
			{
				name: 'PKCS12',
				value: 'PKCS12',
			},
			{
				name: 'PEM',
				value: 'PEM',
			},
		],
		default: 'PEM',
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
				downloadItem: [
					'keystore',
				],
			},
		},
	},
	{
		displayName: 'Certificate Label',
		name: 'certificateLabel',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
				downloadItem: [
					'keystore',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Private Key Passphrase',
		name: 'privateKeyPassphrase',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
				downloadItem: [
					'keystore',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Keystore Passphrase',
		name: 'keystorePassphrase',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
				downloadItem: [
					'keystore',
				],
				keystoreType: [
					'JKS',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
			},
		},
		description: 'Name of the binary property to which to write to',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: [
					'download',
				],
				resource: [
					'certificate',
				],
			},
		},
		options: [
			{
				displayName: 'Chain Order',
				name: 'chainOrder',
				type: 'options',
				options: [
					{
						name: 'EE_FIRST',
						value: 'EE_FIRST',
						description: 'Download the certificate with the end-entity portion of the chain first',
					},
					{
						name: 'EE_ONLY',
						value: 'EE_ONLY',
						description: 'Download only the end-entity certificate',
					},
					{
						name: 'ROOT_FIRST',
						value: 'ROOT_FIRST',
						description: 'Download the certificate with root portion of the chain first',
					},
				],
				default: 'ROOT_FIRST',
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: [
					{
						name: 'PEM',
						value: 'PEM',
					},
					{
						name: 'DER',
						value: 'DER',
					},
				],
				default: 'PEM',
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                                 certificate:get                            */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Certificate ID',
		name: 'certificateId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'get',
					'delete',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: '',
	},
	/* -------------------------------------------------------------------------- */
	/*                                 certificate:getAll                         */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				operation: [
					'getAll',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				operation: [
					'getAll',
				],
				resource: [
					'certificate',
				],
				returnAll: [
					false,
				],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 500,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: [
					'getAll',
				],
				resource: [
					'certificate',
				],
			},
		},
		options: [
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                                 certificate:renew                          */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Application ID',
		name: 'applicationId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getApplications',
		},
		displayOptions: {
			show: {
				operation: [
					'renew',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Existing Certificate ID',
		name: 'existingCertificateId',
		type: 'string',
		displayOptions: {
			show: {
				operation: [
					'renew',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Certificate Issuing Template ID',
		name: 'certificateIssuingTemplateId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getCertificateIssuingTemplates',
		},
		displayOptions: {
			show: {
				operation: [
					'renew',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Certificate Signing Request',
		name: 'certificateSigningRequest',
		type: 'string',
		typeOptions: {
			alwaysOpenEditWindow: true,
		},
		displayOptions: {
			show: {
				operation: [
					'renew',
				],
				resource: [
					'certificate',
				],
			},
		},
		default: '',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: [
					'renew',
				],
				resource: [
					'certificate',
				],
			},
		},
		options: [
			{
				displayName: 'Validity Period',
				name: 'validityPeriod',
				type: 'options',
				options: [
					{
						name: '1 Year',
						value: 'P1Y',
					},
					{
						name: '10 Days',
						value: 'P10D',
					},
					{
						name: '12 Hours',
						value: 'PT12H',
					},
				],
				default: 'P1Y',
			},
		],
	},
];
