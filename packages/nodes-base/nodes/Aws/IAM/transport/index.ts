import type {
	IExecuteSingleFunctions,
	IDataObject,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { REQUEST_DEFAULTS } from '../helpers/constants';

const errorMapping: IDataObject = {
	403: 'The AWS credentials are not valid!',
};

export async function awsApiRequest(
	this: ILoadOptionsFunctions | IPollFunctions | IExecuteSingleFunctions,
	opts: IHttpRequestOptions,
): Promise<IDataObject> {
	const requestOptions: IHttpRequestOptions = {
		...REQUEST_DEFAULTS,
		...opts,
		headers: {
			...REQUEST_DEFAULTS.headers,
			...(opts.headers ?? {}),
		},
	};

	if (opts.body) {
		requestOptions.body = new URLSearchParams(opts.body as Record<string, string>).toString();
	}

	try {
		const response = (await this.helpers.requestWithAuthentication.call(
			this,
			'aws',
			requestOptions,
		)) as IDataObject;
		return response;
	} catch (error) {
		const statusCode = (error?.statusCode || error?.cause?.statusCode) as string;

		if (statusCode && errorMapping[statusCode]) {
			throw new NodeApiError(this.getNode(), {
				message: `AWS error response [${statusCode}]: ${errorMapping[statusCode] as string}`,
			});
		} else {
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}
	}
}
