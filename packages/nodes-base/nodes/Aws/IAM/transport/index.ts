import type {
	IExecuteSingleFunctions,
	IDataObject,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const errorMapping: IDataObject = {
	403: 'The AWS credentials are not valid!',
};

export async function awsApiRequest(
	this: ILoadOptionsFunctions | IPollFunctions | IExecuteSingleFunctions,
	opts: IHttpRequestOptions,
): Promise<IDataObject> {
	const requestOptions: IHttpRequestOptions = {
		...opts,
		baseURL: 'https://iam.amazonaws.com', // ToDo: Can we get the base url and headers from the node description?
		json: true,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	};
	if (opts.body) {
		requestOptions.body = new URLSearchParams(opts.body as Record<string, string>).toString();
	}
	console.log('requestOptions', requestOptions); // ToDo: Remove

	try {
		const response = (await this.helpers.requestWithAuthentication.call(
			this,
			'aws',
			requestOptions,
		)) as IDataObject;
		console.log('response', response); // ToDo: Remove
		return response;
	} catch (error) {
		console.log('error', error); // ToDo: Remove

		const statusCode = (error?.statusCode || error?.cause?.statusCode) as string;

		// ToDo: Are all of these possible and do we need them?
		// const errorMessage = (
		// 	error.response?.body?.message ||
		// 	error.response?.body?.Message ||
		// 	error.message ||
		// 	error.cause.error.message
		// ) as string;

		if (statusCode && errorMapping[statusCode]) {
			throw new NodeApiError(this.getNode(), {
				message: `AWS error response [${statusCode}]: ${errorMapping[statusCode] as string}`,
			});
		} else {
			// ToDo: Ensure if error is not mapped, the original error is thrown
			// throw new NodeApiError(this.getNode(), {message: errorMessage});
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}
	}
}
