import {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';

import FormData from 'form-data';

export async function setupUpload(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
) {
	const mediaPropertyName = this.getNodeParameter('mediaPropertyName') as string;
	if (!mediaPropertyName) {
		return requestOptions;
	}
	if (this.getInputData().binary?.[mediaPropertyName] === undefined) {
		throw new NodeOperationError(
			this.getNode(),
			`The binary property "${mediaPropertyName}" does not exist. So no file can be written!`,
		);
	}
	const binaryFile = this.getInputData().binary![mediaPropertyName]!;
	const mediaFileName = (this.getNodeParameter('additionalFields') as IDataObject).mediaFileName as
		| string
		| undefined;
	const binaryFileName = binaryFile.fileName;
	if (!mediaFileName && !binaryFileName) {
		throw new NodeOperationError(this.getNode(), 'No file name given for media upload.');
	}
	const mimeType = binaryFile.mimeType;


	const buffer = await this.helpers.getBinaryDataBuffer(mediaPropertyName);

	const data = new FormData();
	data.append('file', buffer, {
		contentType: mimeType,
		filename: mediaFileName || binaryFileName,
	});
	data.append('messaging_product', 'whatsapp');

	requestOptions.body = data;
	return requestOptions;
}
