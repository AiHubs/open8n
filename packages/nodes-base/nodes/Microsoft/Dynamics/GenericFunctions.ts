import type { OptionsWithUri } from 'request';

import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	INodeProperties,
	INodePropertyOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const addressFields: INodeProperties[] = [
	{
		displayName: 'City',
		name: 'city',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		default: '',
	},
	{
		displayName: 'County',
		name: 'county',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Fax',
		name: 'fax',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		typeOptions: {
			maxValue: 90,
			minValue: -90,
			numberPrecision: 6,
		},
		default: '',
	},
	{
		displayName: 'Line1',
		name: 'line1',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Line2',
		name: 'line2',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Line3',
		name: 'line3',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Longitude',
		name: 'longitude',
		type: 'number',
		typeOptions: {
			maxValue: 180,
			minValue: -180,
			numberPrecision: 6,
		},
		default: '',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Descriptive name for the address, such as Corporate Headquarters.',
	},
	{
		displayName: 'Postal Code',
		name: 'postalcode',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Post Office Box',
		name: 'postofficebox',
		type: 'string',
		default: '',
	},
	{
		displayName: 'State or Province',
		name: 'stateorprovince',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Telephone 1',
		name: 'telephone1',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Telephone 2',
		name: 'telephone2',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Telephone 3',
		name: 'telephone3',
		type: 'string',
		default: '',
	},
	{
		displayName: 'UPS Zone',
		name: 'upszone',
		type: 'string',
		default: '',
		description:
			'The UPS zone of the address to make sure shipping charges are calculated correctly and deliveries are made promptly, if shipped by UPS.',
	},
	{
		displayName: 'UTC Offset',
		name: 'utcoffset',
		type: 'number',
		typeOptions: {
			maxValue: 1500,
			minValue: -1500,
		},
		default: '',
		description:
			'The time zone, or UTC offset, for this address so that other people can reference it when they contact someone at this address.',
	},
];

export async function microsoftApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: any = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
): Promise<any> {
	const credentials = (await this.getCredentials('microsoftDynamicsOAuth2Api')) as {
		subdomain: string;
		region: string;
	};

	let options: OptionsWithUri = {
		headers: {
			'Content-Type': 'application/json',
			accept: 'application/json',
			Prefer: 'return=representation',
		},
		method,
		body,
		qs,
		uri: uri || `https://${credentials.subdomain}.${credentials.region}/api/data/v9.2${resource}`,
		json: true,
	};

	try {
		if (Object.keys(option).length !== 0) {
			options = Object.assign({}, options, option);
		}
		//@ts-ignore
		return await this.helpers.requestOAuth2.call(this, 'microsoftDynamicsOAuth2Api', options, {
			property: 'id_token',
		});
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function microsoftApiRequestAllItems(
	this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
): Promise<any> {
	const returnData: IDataObject[] = [];

	let responseData;
	let uri: string | undefined;
	query.$top = 100;

	do {
		responseData = await microsoftApiRequest.call(this, method, endpoint, body, query, uri);
		uri = responseData['@odata.nextLink'];
		returnData.push.apply(returnData, responseData[propertyName] as IDataObject[]);
	} while (responseData['@odata.nextLink'] !== undefined);

	return returnData;
}

export async function getPicklistOptions(
	this: ILoadOptionsFunctions,
	entityName: string,
	attributeName: string,
): Promise<INodePropertyOptions[]> {
	const returnData: INodePropertyOptions[] = [];
	const endpoint = `/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options),GlobalOptionSet($select=Options)`;
	const {
		OptionSet: { Options: options },
	} = await microsoftApiRequest.call(this, 'GET', endpoint);
	for (const option of options) {
		returnData.push({
			name: option.Label.UserLocalizedLabel.Label,
			value: option.Value,
		});
	}
	return returnData;
}

export async function getEntityFields(
	this: ILoadOptionsFunctions,
	entityName: string,
): Promise<IField[]> {
	const endpoint = `/EntityDefinitions(LogicalName='${entityName}')/Attributes`;
	const { value } = await microsoftApiRequest.call(this, 'GET', endpoint);
	return value;
}

export function buildQs({
	options = {},
	filters = {},
	requiredReturnFields = [],
}: {
	options?: IDataObject;
	filters?: IDataObject;
	requiredReturnFields?: string[];
}): IDataObject {
	const qs: IDataObject = {};
	const returnFields = requiredReturnFields;

	if (options.returnFields) {
		returnFields.push(...(options.returnFields as string[]));
	}

	if (returnFields.length) {
		qs.$select = [...new Set(returnFields)].join(',');
	}

	if (options.expandFields) {
		qs.$expand = (options.expandFields as string[]).join(',');
	}

	if (filters.query) {
		qs.$filter = filters.query as string;
	}

	return qs;
}

export function adjustAddresses(addresses: [{ [key: string]: string }]) {
	const results: { [key: string]: any } = {};

	for (const [index, address] of addresses.entries()) {
		for (const key of Object.keys(address)) {
			if (address[key] !== '') {
				results[`address${index + 1}_${key}`] = address[key];
			}
		}
	}

	return results;
}

export function adjustBody(body: IRawBody = {}): IDataObject {
	const { addresses, customFields } = body;

	if (addresses?.address) {
		Object.assign(body, adjustAddresses(addresses.address));

		//@ts-ignore
		delete body.addresses;
	}

	if (customFields) {
		customFields.map(({ name, value }) => {
			body[name] = value;
		});

		delete body.customFields;
	}

	return body;
}

export function getAccountFields(): INodeProperties[] {
	return [
		{
			displayName: 'Account Category Name or ID',
			name: 'accountcategorycode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAccountCategories',
			},
			default: '',
			description:
				'Category to indicate whether the customer account is standard or preferred. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Account Rating Name or ID',
			name: 'accountratingcode',
			type: 'options',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
			typeOptions: {
				loadOptionsMethod: 'getAccountRatingCodes',
			},
			default: '',
		},
		{
			displayName: 'Address',
			name: 'addresses',
			type: 'fixedCollection',
			default: {},
			typeOptions: {
				multipleValues: true,
			},
			placeholder: 'Add Address Field',
			options: [
				{
					displayName: 'Address Fields',
					name: 'address',
					values: [
						{
							displayName: 'Address Type Name or ID',
							name: 'addresstypecode',
							type: 'options',
							description:
								'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
							typeOptions: {
								loadOptionsMethod: 'getAccountAddressTypes',
							},
							default: '',
						},
						...addressFields,
						{
							displayName: 'Freight Terms',
							name: 'freighttermscode',
							type: 'options',
							typeOptions: {
								loadOptionsMethod: 'getAccountAddressFreightTermsCodes',
							},
							default: '',
							description:
								'The freight terms for the address to make sure shipping orders are processed correctly. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
						},
						{
							displayName: 'Primary Contact Name',
							name: 'primarycontactname',
							type: 'string',
							default: '',
						},
						{
							displayName: 'Shipping Method',
							name: 'shippingmethodcode',
							type: 'options',
							typeOptions: {
								loadOptionsMethod: 'getAccountAddressShippingMethodCodes',
							},
							default: '',
							description:
								'Shipping method for deliveries sent to this address. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
						},
					],
				},
			],
		},
		{
			displayName: 'Business Type Name or ID',
			name: 'businesstypecode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getBusinessTypes',
			},
			default: '',
			description:
				'The legal designation or other business type of the account for contracts or reporting purposes. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Customer Size Name or ID',
			name: 'customersizecode',
			type: 'options',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
			typeOptions: {
				loadOptionsMethod: 'getCustomerSizeCodes',
			},
			default: '',
		},
		{
			displayName: 'Customer Type Name or ID',
			name: 'customertypecode',
			type: 'options',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
			typeOptions: {
				loadOptionsMethod: 'getCustomerTypeCodes',
			},
			default: '',
		},
		{
			displayName: 'Description',
			name: 'description',
			type: 'string',
			typeOptions: {
				rows: 3,
			},
			default: '',
			description:
				'Additional information to describe the account, such as an excerpt from the company’s website',
		},
		{
			displayName: 'Email Address 1',
			name: 'emailaddress1',
			type: 'string',
			default: '',
			description: 'The primary email address for the account',
		},
		{
			displayName: 'Email Address 2',
			name: 'emailaddress2',
			type: 'string',
			default: '',
			description: 'The secondary email address for the account',
		},
		{
			displayName: 'Email Address 3',
			name: 'emailaddress3',
			type: 'string',
			default: '',
			description: 'Alternate email address for the account',
		},
		{
			displayName: 'Fax',
			name: 'fax',
			type: 'string',
			default: '',
		},
		{
			displayName: 'FTP site URL',
			name: 'ftpsiteurl',
			type: 'string',
			default: '',
			description:
				'URL for the account’s FTP site to enable users to access data and share documents',
		},
		{
			displayName: 'Industry Name or ID',
			name: 'industrycode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAccountIndustryCodes',
			},
			default: '',
			description:
				'The account’s primary industry for use in marketing segmentation and demographic analysis. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Name',
			name: 'name',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					'/resource': ['account'],
					'/operation': ['update'],
				},
			},
			description: 'Company o business name',
		},
		{
			displayName: 'Credit Limit',
			name: 'creditlimit',
			type: 'number',
			typeOptions: {
				maxValue: 100000000000000,
				minValue: 0,
				numberPrecision: 2,
			},
			default: '',
			description:
				'Credit limit of the account. This is a useful reference when you address invoice and accounting issues with the customer.',
		},
		{
			displayName: 'Number Of Employees',
			name: 'numberofemployees',
			type: 'number',
			typeOptions: {
				maxValue: 1000000000,
				minValue: 0,
			},
			default: '',
			description:
				'Number of employees that work at the account for use in marketing segmentation and demographic analysis.',
		},
		{
			displayName: 'Payment Terms Name or ID',
			name: 'paymenttermscode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getPaymentTermsCodes',
			},
			default: '',
			description:
				'The payment terms to indicate when the customer needs to pay the total amount. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Preferred Appointment Day Name or ID',
			name: 'preferredappointmentdaycode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getPreferredAppointmentDayCodes',
			},
			default: '',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
		},
		{
			displayName: 'Preferred Appointment Time Name or ID',
			name: 'preferredappointmenttimecode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getPreferredAppointmentTimeCodes',
			},
			default: '',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
		},
		{
			displayName: 'Preferred Contact Method Name or ID',
			name: 'preferredcontactmethodcode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAccountPreferredContactMethodCodes',
			},
			default: '',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
		},
		{
			displayName: 'Primary Satori ID',
			name: 'primarysatoriid',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Primary Twitter ID',
			name: 'primarytwitterid',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Revenue',
			name: 'revenue',
			type: 'number',
			typeOptions: {
				maxValue: 100000000000000,
				minValue: 0,
				numberPrecision: 2,
			},
			default: '',
			description:
				'The annual revenue for the account, used as an indicator in financial performance analysis.',
		},
		{
			displayName: 'Shares Outstanding',
			name: 'sharesoutstanding',
			type: 'number',
			typeOptions: {
				maxValue: 1000000000,
				minValue: 0,
				numberPrecision: 2,
			},
			default: '',
			description:
				'The number of shares available to the public for the account. This number is used as an indicator in financial performance analysis.',
		},
		{
			displayName: 'Shipping Method Name or ID',
			name: 'shippingmethodcode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getShippingMethodCodes',
			},
			default: '',
			description:
				'Shipping method for deliveries sent to the account’s address to designate the preferred carrier or other delivery option. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'SIC',
			name: 'sic',
			type: 'string',
			default: '',
			description:
				'The Standard Industrial Classification (SIC) code that indicates the account’s primary industry of business, for use in marketing segmentation and demographic analysis.',
		},
		{
			displayName: 'Stage ID',
			name: 'stageid',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Stock Exchange',
			name: 'stockexchange',
			type: 'string',
			default: '',
			description:
				'The stock exchange at which the account is listed to track their stock and financial performance of the company',
		},
		{
			displayName: 'Telephone 1',
			name: 'telephone1',
			type: 'string',
			default: '',
			description: 'The main phone number for this account',
		},
		{
			displayName: 'Telephone 2',
			name: 'telephone2',
			type: 'string',
			default: '',
			description: 'The second phone number for this account',
		},
		{
			displayName: 'Telephone 3',
			name: 'telephone3',
			type: 'string',
			default: '',
			description: 'The third phone number for this account',
		},
		{
			displayName: 'Territory Name or ID',
			name: 'territorycode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getTerritoryCodes',
			},
			default: '',
			description:
				'Region or territory for the account for use in segmentation and analysis. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Ticker Symbol',
			name: 'tickersymbol',
			type: 'string',
			default: '',
			description:
				'Type the stock exchange symbol for the account to track financial performance of the company. You can click the code entered in this field to access the latest trading information from MSN Money.',
		},
		{
			displayName: 'Website URL',
			name: 'websiteurl',
			type: 'string',
			default: '',
			description: 'The account’s website URL to get quick details about the company profile.',
		},
		{
			displayName: 'Yomi Name',
			name: 'yominame',
			type: 'string',
			default: '',
			description:
				'The phonetic spelling of the company name, if specified in Japanese, to make sure the name is pronounced correctly in phone calls and other communications',
		},
	];
}

export function getLeadFields(): INodeProperties[] {
	return [
		{
			displayName: 'Address',
			name: 'addresses',
			type: 'fixedCollection',
			default: {},
			typeOptions: {
				multipleValues: true,
			},
			placeholder: 'Add Address Field',
			options: [
				{
					displayName: 'Address Fields',
					name: 'address',
					values: [
						{
							displayName: 'Address Type Name or ID',
							name: 'addresstypecode',
							type: 'options',
							description:
								'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
							typeOptions: {
								loadOptionsMethod: 'getLeadAddressTypes',
							},
							default: '',
						},
						...addressFields,
						{
							displayName: 'Shipping Method',
							name: 'shippingmethodcode',
							type: 'options',
							typeOptions: {
								loadOptionsMethod: 'getLeadAddressShippingMethodCodes',
							},
							default: '',
							description:
								'Shipping method for deliveries sent to this address. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
						},
					],
				},
			],
		},
		{
			displayName: 'Budget Amount',
			name: 'budgetamount',
			type: 'number',
			typeOptions: {
				maxValue: 1000000000000,
				minValue: 0,
				numberPrecision: 2,
			},
			default: '',
			description: 'Information about the budget amount of the lead’s company or organization.',
		},
		{
			displayName: 'Budget',
			name: 'budgetstatus',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadBudgetStatuses',
			},
			default: '',
			description:
				'Information about the budget status of the lead’s company or organization. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Company Name',
			name: 'companyname',
			type: 'string',
			default: '',
			description:
				'Name of the company associated with the lead. This becomes the account name when the lead is qualified and converted to a customer account.',
		},
		{
			displayName: 'Confirm Interest',
			name: 'confirminterest',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getBooleanOptions',
			},
			default: '',
			description:
				'Whether the lead confirmed interest in your offerings. This helps in determining the lead quality. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Decision Maker?',
			name: 'decisionmaker',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadDecisionMakerOptions',
			},
			default: '',
			description:
				'Whether your notes include information about who makes the purchase decisions at the lead’s company. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Description',
			name: 'description',
			type: 'string',
			typeOptions: {
				rows: 3,
			},
			default: '',
			description:
				'Additional information to describe the lead, such as an excerpt from the company’s website. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Do not allow Bulk Emails',
			name: 'donotbulkemail',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAllowOptions',
			},
			default: '',
			description:
				'Whether the lead accepts bulk email sent through marketing campaigns or quick campaigns. If Do Not Allow is selected, the lead can be added to marketing lists, but will be excluded from the email. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Do not allow Emails',
			name: 'donotemail',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAllowOptions',
			},
			default: '',
			description:
				'Whether the lead allows direct email sent from Microsoft Dynamics 365. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Do not allow Faxes',
			name: 'donotfax',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAllowOptions',
			},
			default: '',
			description:
				'Whether the lead allows faxes. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Do not allow Phone Calls',
			name: 'donotphone',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAllowOptions',
			},
			default: '',
			description:
				'Whether the lead allows phone calls. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Do not allow Mails',
			name: 'donotpostalmail',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAllowOptions',
			},
			default: '',
			description:
				'Whether the lead allows direct mail. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Marketing Material',
			name: 'donotsendmm',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getAllowOptions',
			},
			default: '',
			description:
				'Whether the lead accepts marketing materials, such as brochures or catalogs. Leads that opt out can be excluded from marketing initiatives. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Email Address 1',
			name: 'emailaddress1',
			type: 'string',
			default: '',
			description: 'The primary email address for the account',
		},
		{
			displayName: 'Email Address 2',
			name: 'emailaddress2',
			type: 'string',
			default: '',
			description: 'The secondary email address for the account',
		},
		{
			displayName: 'Email Address 3',
			name: 'emailaddress3',
			type: 'string',
			default: '',
			description: 'Alternate email address for the account',
		},
		{
			displayName: 'Est. Value',
			name: 'estimatedamount',
			type: 'number',
			typeOptions: {
				maxValue: 1000000000000,
				minValue: 0,
				numberPrecision: 2,
			},
			default: '',
			description:
				'Estimated revenue value that this lead will generate to assist in sales forecasting and planning.',
		},
		{
			displayName: 'Est. Close Date',
			name: 'estimatedclosedate',
			type: 'dateTime',
			default: '',
			description:
				'Expected close date for the lead, so that the sales team can schedule timely follow-up meetings to move the prospect to the next sales stage.',
		},
		{
			displayName: 'Evaluate Fit',
			name: 'evaluatefit',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getBooleanOptions',
			},
			default: '',
			description:
				'Whether the fit between the lead’s requirements and your offerings was evaluated. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Fax',
			name: 'fax',
			type: 'string',
			default: '',
			description: 'Fax number for the primary contact for the lead.',
		},
		{
			displayName: 'First Name',
			name: 'firstname',
			type: 'string',
			default: '',
			description:
				'First name of the primary contact for the lead to make sure the prospect is addressed correctly in sales calls, email, and marketing campaigns.',
		},
		{
			displayName: 'Follow Email Activity',
			name: 'followemail',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadFollowEmailOptions',
			},
			default: '',
			description:
				'Whether to allow following email activity like opens, attachment views and link clicks for emails sent to the lead. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Import Sequence Number',
			name: 'importsequencenumber',
			type: 'number',
			typeOptions: {
				maxValue: 2147483647,
				minValue: -2147483648,
			},
			default: '',
			description: 'Sequence number of the import that created this record.',
		},
		{
			displayName: 'Industry Name or ID',
			name: 'industrycode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadIndustryCodes',
			},
			default: '',
			description:
				'Primary industry in which the lead’s business is focused, for use in marketing segmentation and demographic analysis. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Job Title',
			name: 'jobtitle',
			type: 'string',
			default: '',
			description:
				'Job title of the primary contact for this lead to make sure the prospect is addressed correctly in sales calls, email, and marketing campaigns.',
		},
		{
			displayName: 'Last Name',
			name: 'lastname',
			type: 'string',
			default: '',
			description:
				'Last name of the primary contact for the lead to make sure the prospect is addressed correctly in sales calls, email, and marketing campaigns',
		},
		{
			displayName: 'Middle Name',
			name: 'middlename',
			type: 'string',
			default: '',
			description:
				'The middle name or initial of the primary contact for the lead to make sure the prospect is addressed correctly.',
		},
		{
			displayName: 'Mobile Phone',
			name: 'mobilephone',
			type: 'string',
			default: '',
			description: 'Mobile phone number for the primary contact for the lead.',
		},
		{
			displayName: 'Number Of Employees',
			name: 'numberofemployees',
			type: 'number',
			typeOptions: {
				maxValue: 1000000,
				minValue: 0,
			},
			default: '',
			description:
				'number of employees that work at the company associated with the lead, for use in marketing segmentation and demographic analysis.',
		},
		{
			displayName: 'Preferred Contact Method Name or ID',
			name: 'preferredcontactmethodcode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadPreferredContactMethodCodes',
			},
			default: '',
			description:
				'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
		},
		{
			displayName: 'Rating',
			name: 'leadqualitycode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadQualityCodes',
			},
			default: '',
			description:
				'Rating value to indicate the lead’s potential to become a customer. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Lead Source',
			name: 'leadsourcecode',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getLeadSourceCodes',
			},
			default: '',
			description:
				'The primary marketing source that prompted the lead to contact you. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		},
		{
			displayName: 'Revenue',
			name: 'revenue',
			type: 'number',
			typeOptions: {
				maxValue: 100000000000000,
				minValue: 0,
				numberPrecision: 2,
			},
			default: '',
			description:
				'The annual revenue of the company associated with the lead to provide an understanding of the prospect’s business.',
		},
		{
			displayName: 'SIC',
			name: 'sic',
			type: 'string',
			default: '',
			description:
				'The Standard Industrial Classification (SIC) code that indicates the lead’s primary industry of business for use in marketing segmentation and demographic analysis.',
		},
		{
			displayName: 'SLA',
			name: 'slaid',
			type: 'string',
			default: '',
			description: 'The service level agreement (SLA) that you want to apply to the Lead record.',
		},
		{
			displayName: 'Stage ID',
			name: 'stageid',
			type: 'string',
			default: '',
			description: 'The ID of the stage where the entity is located.',
		},
		{
			displayName: 'Topic',
			name: 'subject',
			type: 'string',
			default: '',
			description:
				'Subject or descriptive name, such as the expected order, company name, or marketing source list, to identify the lead.',
		},
		{
			displayName: 'Telephone 1',
			name: 'telephone1',
			type: 'string',
			default: '',
			description: 'The main phone number for this account',
		},
		{
			displayName: 'Telephone 2',
			name: 'telephone2',
			type: 'string',
			default: '',
			description: 'The second phone number for this account',
		},
		{
			displayName: 'Telephone 3',
			name: 'telephone3',
			type: 'string',
			default: '',
			description: 'The third phone number for this account',
		},
		{
			displayName: 'Website URL',
			name: 'websiteurl',
			type: 'string',
			default: '',
			description: 'The website URL for the company associated with this lead.',
		},
		{
			displayName: 'Yomi Company Name',
			name: 'yomicompanyname',
			type: 'string',
			default: '',
			description:
				'The phonetic spelling of the lead’s company name, if the name is specified in Japanese, to make sure the name is pronounced correctly in phone calls with the prospect.',
		},
		{
			displayName: 'Yomi First Name',
			name: 'yomifirstname',
			type: 'string',
			default: '',
			description:
				'The phonetic spelling of the lead’s first name, if the name is specified in Japanese, to make sure the name is pronounced correctly in phone calls with the prospect.',
		},
		{
			displayName: 'Yomi Last Name',
			name: 'yomilastname',
			type: 'string',
			default: '',
			description:
				'The phonetic spelling of the lead’s last name, if the name is specified in Japanese, to make sure the name is pronounced correctly in phone calls with the prospect.',
		},
	];
}

export const sort = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export const formatFields = (fields: IField[]) => {
	const isSelectable = (field: IField) =>
		field.IsValidForRead &&
		field.CanBeSecuredForRead &&
		field.IsValidODataAttribute &&
		field.LogicalName !== 'slaid';

	return fields
		.filter(isSelectable)
		.filter((field) => field.DisplayName.UserLocalizedLabel?.Label)
		.map((field) => ({
			name: field.DisplayName.UserLocalizedLabel.Label,
			value: field.LogicalName,
		}))
		.sort(sort);
};

export interface ICustomField {
	name: string;
	value: string;
}

export interface ICustomFields {
	customFields: ICustomField[];
}
export interface IField {
	IsRetrievable: boolean;
	LogicalName: string;
	IsSearchable: string;
	IsValidODataAttribute: string;
	IsValidForRead: string;
	CanBeSecuredForRead: string;
	AttributeType: string;
	IsSortableEnabled: {
		Value: boolean;
	};
	DisplayName: {
		UserLocalizedLabel: {
			Label: string;
		};
	};
}

export interface IOperationFunction {
	(
		this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
		index: number,
	): Promise<any>;
}

export interface IRawBody extends IDataObject {
	addresses?: { address: [{ [key: string]: any }] };
	customFields?: ICustomField[];
}
