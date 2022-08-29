import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
} from 'n8n-core';

import {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	NodeApiError,
} from 'n8n-workflow';

export async function dhlApiRequest(
	this: IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	// tslint:disable-next-line:no-any
	body: any = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
	// tslint:disable-next-line:no-any
): Promise<any> {
	const credentials = (await this.getCredentials('dhlApi')) as { apiKey: string };

	let options: IHttpRequestOptions = {
		headers: {
			'DHL-API-Key': credentials.apiKey,
		},
		method,
		qs,
		body,
		uri: uri || `https://api-eu.dhl.com${path}`,
		json: true,
	};
	options = Object.assign({}, options, option);
	if (Object.keys(options.body!).length === 0) {
		delete options.body;
	}

	try {
		return await this.helpers.request!(options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error);
	}
}

export async function validateCredentials(
	this: ICredentialTestFunctions,
	decryptedCredentials: ICredentialDataDecryptedObject,
	// tslint:disable-next-line:no-any
): Promise<any> {
	const credentials = decryptedCredentials;

	const { apiKey } = credentials as {
		apiKey: string;
	};

	const options: IHttpRequestOptions = {
		headers: {
			'DHL-API-Key': apiKey,
		},
		qs: {
			trackingNumber: 123,
		},
		method: 'GET',
		uri: `https://api-eu.dhl.com/track/shipments`,
		json: true,
	};

	return this.helpers.request!(options);
}
