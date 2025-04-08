import type {
	JsonObject,
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

interface IAwsError {
	Code: string;
	Message: string;
}

interface IErrorResponse {
	message: string;
	description: string;
}

function mapErrorToResponse(errorCode: string, errorMessage: string): IErrorResponse | undefined {
	if (errorCode === 'EntityAlreadyExists') {
		if (errorMessage.includes('User')) {
			return {
				message: errorMessage,
				description: 'Users must have unique names. Enter a different name for the new user.',
			};
		}
		if (errorMessage.includes('Group')) {
			return {
				message: errorMessage,
				description: 'Groups must have unique names. Enter a different name for the new group.',
			};
		}
	}

	if (errorCode === 'NoSuchEntity') {
		if (errorMessage.includes('User')) {
			return {
				message: errorMessage,
				description: 'The given user was not found - try entering a different user.',
			};
		}
		if (errorMessage.includes('Group')) {
			return {
				message: errorMessage,
				description: 'The given group was not found - try entering a different group.',
			};
		}
	}

	if (errorCode === 'DeleteConflict') {
		return {
			message: errorMessage,
			description: 'Cannot delete entity, please remove users from group first.',
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
	const error = responseBody.Error as IAwsError;

	if (!error) {
		throw new NodeApiError(this.getNode(), response as unknown as JsonObject);
	}

	const errorCode = error.Code;
	const errorMessage = error.Message;

	const specificError = mapErrorToResponse(errorCode, errorMessage);

	if (specificError) {
		throw new NodeApiError(this.getNode(), response as unknown as JsonObject, specificError);
	} else {
		throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
			message: errorCode,
			description: errorMessage,
		});
	}
}
