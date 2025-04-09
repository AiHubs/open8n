import type {
	JsonObject,
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { ERROR_MESSAGES } from './constants';
import type { AwsError, ErrorMessage } from './types';

function mapErrorToResponse(errorCode: string, errorMessage: string): ErrorMessage | undefined {
	if (errorCode === 'EntityAlreadyExists') {
		if (errorMessage.includes('user') || errorMessage.includes('User')) {
			return {
				message: errorMessage,
				description: ERROR_MESSAGES.EntityAlreadyExists.User,
			};
		}
		if (errorMessage.includes('group') || errorMessage.includes('Group')) {
			return {
				message: errorMessage,
				description: ERROR_MESSAGES.EntityAlreadyExists.Group,
			};
		}
	}

	if (errorCode === 'NoSuchEntity') {
		if (errorMessage.includes('user') || errorMessage.includes('User')) {
			return {
				message: errorMessage,
				description: ERROR_MESSAGES.NoSuchEntity.User,
			};
		}
		if (errorMessage.includes('group') || errorMessage.includes('Group')) {
			return {
				message: errorMessage,
				description: ERROR_MESSAGES.NoSuchEntity.Group,
			};
		}
	}

	if (errorCode === 'DeleteConflict') {
		return {
			message: errorMessage,
			description: ERROR_MESSAGES.DeleteConflict.Default,
		};
	}

	return undefined;
}

export async function handleError(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const statusCode = String(response.statusCode);

	if (!statusCode.startsWith('4') && !statusCode.startsWith('5')) {
		return data;
	}

	const responseBody = response.body as IDataObject;
	const error = responseBody.Error as AwsError;

	if (!error) {
		throw new NodeApiError(this.getNode(), response as unknown as JsonObject);
	}

	const specificError = mapErrorToResponse(error.Code, error.Message);

	if (specificError) {
		throw new NodeApiError(this.getNode(), response as unknown as JsonObject, specificError);
	} else {
		throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
			message: error.Code,
			description: error.Message,
		});
	}
}
