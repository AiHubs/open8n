import type {
	IHttpRequestOptions,
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CURRENT_VERSION } from './constants';
import type {
	IGetAllGroupsResponseBody,
	IGetAllUsersResponseBody,
	IGetGroupResponseBody,
	ITags,
	IUser,
} from './types';
import { searchGroupsForUser } from '../methods/listSearch';
import { awsApiRequest } from '../transport';

export async function encodeBodyAsFormUrlEncoded(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	if (requestOptions.body) {
		requestOptions.body = new URLSearchParams(
			requestOptions.body as Record<string, string>,
		).toString();
	}
	return requestOptions;
}

async function findUsersForGroup(
	this: IExecuteSingleFunctions,
	groupName: string,
): Promise<IDataObject[]> {
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: '',
		body: new URLSearchParams({
			Action: 'GetGroup',
			Version: CURRENT_VERSION,
			GroupName: groupName,
		}).toString(),
	};
	const responseData = (await awsApiRequest.call(this, options)) as IGetGroupResponseBody;
	return responseData?.GetGroupResponse?.GetGroupResult?.Users ?? [];
}

export async function simplifyGetGroupsResponse(
	this: IExecuteSingleFunctions,
	_: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const includeUsers = this.getNodeParameter('includeUsers', false);
	const responseBody = response.body as IGetGroupResponseBody;
	const groupData = responseBody.GetGroupResponse.GetGroupResult;
	const group = groupData.Group;
	return [
		{ json: includeUsers ? { ...group, Users: groupData.Users ?? [] } : group },
	] as INodeExecutionData[];
}

export async function simplifyGetAllGroupsResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const includeUsers = this.getNodeParameter('includeUsers', false);
	const responseBody = response.body as IGetAllGroupsResponseBody;
	const groups = responseBody.ListGroupsResponse.ListGroupsResult.Groups ?? [];

	if (groups.length === 0) {
		return items;
	}

	if (!includeUsers) {
		return groups.map((group) => ({ json: group })); // ToDo : Use n8n function
	}

	const processedItems: INodeExecutionData[] = [];
	for (const group of groups) {
		if (group.GroupName) {
			// ToDo: Is this check needed? Isn't GroupName mandatory?
			const users = await findUsersForGroup.call(this, group.GroupName as string); // ToDo: Use interface for IGroup where groups is defined
			processedItems.push({ json: { ...group, Users: users } });
		}
	}
	return processedItems;
}

export async function simplifyGetAllUsersResponse(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (!response.body) {
		return [];
	}
	const users =
		(response.body as IGetAllUsersResponseBody)?.ListUsersResponse?.ListUsersResult?.Users ?? [];
	return users.map((user) => ({ json: user })); // ToDo: Use n8n function
}

// ToDo: Check if this can be optimized
export async function deleteGroupMembers(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const groupName = this.getNodeParameter('group', undefined, { extractValue: true }) as string;

	const users = await findUsersForGroup.call(this, groupName);
	if (!users.length) {
		return requestOptions;
	}

	await Promise.all(
		users.map(async (user) => {
			const userName = user.UserName as string;
			if (!user.UserName) {
				return;
			}

			try {
				await awsApiRequest.call(this, {
					method: 'POST',
					url: '',
					body: {
						Action: 'RemoveUserFromGroup',
						GroupName: groupName,
						UserName: userName,
						Version: CURRENT_VERSION,
					},
					ignoreHttpStatusErrors: true,
				});
			} catch (error) {
				// ToDo: I think we shouldn't console log that? Should we throw an error?
				console.error(`⚠️ Failed to remove user "${userName}" from "${groupName}":`, error);
			}
		}),
	);

	return requestOptions;
}

export async function validatePath(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const path = this.getNodeParameter('additionalFields.path') as string;
	if (path.length < 1 || path.length > 512) {
		throw new NodeOperationError(
			this.getNode(),
			'The "Path" parameter must be between 1 and 512 characters long',
		);
	}

	const validPathRegex = /^\/[\u0021-\u007E]*\/$/;
	if (!validPathRegex.test(path) && path !== '/') {
		throw new NodeOperationError(
			this.getNode(),
			'Ensure the path follows the pattern: /division_abc/subdivision_xyz/',
		);
	}

	return requestOptions;
}

export async function validateUserPath(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const prefix = this.getNodeParameter('additionalFields.pathPrefix') as string;

	// ToDo: Is that the full validation? validatePath() uses a regex.
	// If nothing else is needed why don't we correct for that when sending instead of validating?
	if (!prefix.startsWith('/') || !prefix.endsWith('/')) {
		throw new NodeOperationError(
			this.getNode(),
			'Ensure the path is structured correctly, e.g. /division_abc/subdivision_xyz/',
		);
	}

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: '',
		body: {
			Action: 'ListUsers',
			Version: CURRENT_VERSION,
		},
	};
	const responseData = (await awsApiRequest.call(this, options)) as IGetAllUsersResponseBody;

	const users = responseData.ListUsersResponse.ListUsersResult.Users as IUser[];
	if (!users || users.length === 0) {
		// ToDo: Should the error be '... Please adjust the "Path" parameter and try again.'?
		throw new NodeOperationError(this.getNode(), 'No users found in the group. Please try again.');
	}

	const userPaths = users.map((user) => user.Path).filter(Boolean);
	const isPathValid = userPaths.some((path) => path?.startsWith(prefix));
	if (!isPathValid) {
		throw new NodeOperationError(
			this.getNode(),
			`The "${prefix}" path was not found in your users. Try entering a different path.`,
		);
	}
	return requestOptions;
}

export async function validatePermissionsBoundary(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const permissionsBoundary = this.getNodeParameter(
		'additionalFields.permissionsBoundary',
	) as string;

	if (permissionsBoundary) {
		const arnPattern = /^arn:aws:iam::\d{12}:policy\/[\w\-+\/=._]+$/;

		if (!arnPattern.test(permissionsBoundary)) {
			throw new NodeOperationError(
				this.getNode(),
				'The permissions boundary must be in ARN format, e.g., arn:aws:iam::123456789012:policy/ExamplePolicy',
			);
		}

		if (requestOptions.body) {
			// @ts-expect-error The if statement ensures that there is body
			requestOptions.body.PermissionsBoundary = permissionsBoundary;
		} else {
			requestOptions.body = {
				PermissionsBoundary: permissionsBoundary,
			};
		}
	}
	return requestOptions;
}

export async function preprocessTags(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const tagsData = this.getNodeParameter('additionalFields.tags') as ITags;
	const tags = tagsData?.tags || [];

	requestOptions.body ??= {};
	tags.forEach((tag, index) => {
		// @ts-expect-error The line above ensures that body is defined
		requestOptions.body[`Tags.member.${index + 1}.Key`] = tag.key;
		// @ts-expect-error The line above ensures that body is defined
		requestOptions.body[`Tags.member.${index + 1}.Value`] = tag.value;
	});
	return requestOptions;
}

export async function removeUserFromGroups(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const userName = this.getNodeParameter('user', undefined, { extractValue: true });
	const userGroups = await searchGroupsForUser.call(this);

	for (const group of userGroups.results) {
		await awsApiRequest.call(this, {
			method: 'POST',
			url: '',
			body: {
				Action: 'RemoveUserFromGroup',
				Version: CURRENT_VERSION,
				GroupName: group.value,
				UserName: userName,
			},
		});
	}

	return requestOptions;
}

// ToDo: Do we need a handle pagination with a function? A function that wasn't used was removed.
