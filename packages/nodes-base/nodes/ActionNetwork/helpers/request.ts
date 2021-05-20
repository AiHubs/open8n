import { OptionsWithUri } from 'request';

import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-core';

import * as querystring from 'querystring';

export async function actionNetworkApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions,
	method: string,
	pathOrUri: string,
	body?: any,
	headers?: object,
	qs?: any
): Promise<any> { // tslint:disable-line:no-any
	const credentials = this.getCredentials('ActionNetworkGroupApiToken');

	if (credentials === undefined) {
		throw new Error('No credentials got returned!');
	}

	const options: OptionsWithUri = {
		headers: {
			'OSDI-API-Token': credentials.apiKey,
			'Content-Type': 'application/json',
			...(headers || {}),
		},
		method,
		uri: pathOrUri.startsWith('/') ? `https://actionnetwork.org${pathOrUri}` : pathOrUri,
		body: JSON.stringify(body),
		qs
	};

	try {
		const data = await this.helpers.request!(options);
		try {
			return JSON.parse(data);
		} catch (e) {
			return data;
		}
	} catch (error) {
		const errorMessage = (error.response && error.response.body.message) || (error.response && error.response.body.Message) || error.message;

		if (error.statusCode === 403) {
			throw new Error('The Action Network credentials are not valid!');
		}

		throw new Error(`Action Network error response [${error.statusCode}]: ${errorMessage}`);
	}
}

export async function *iterateActionNetworkApiRequest(
	hook: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions,
	method: string,
	pathOrUri: string,
	resource: string,
	body?: any,
	headers?: object,
	qs?: any
) {
	let res
	let nextPage: any = 1

	do {
		res = await actionNetworkApiRequest.call(hook, method, pathOrUri, body, headers, { ...qs, page: nextPage })
		nextPage = res?.['_links']?.['next']?.split('=')?.[1]

		for (const embedded of res._embedded[resource]) {
			yield embedded
		}
	} while (nextPage)
}
