/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */

import type { ILoadOptionsFunctions } from 'n8n-workflow';

import { searchUsers, searchGroups, searchGroupsForUser } from '../../methods/listSearch';
import { awsApiRequest } from '../../transport';

jest.mock('../../transport', () => ({
	awsApiRequest: jest.fn(),
}));

describe('AWS IAM - List search', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	const mockContext = {
		helpers: {
			requestWithAuthentication: jest.fn(),
		},
		getNodeParameter: jest.fn(),
		getCredentials: jest.fn(),
	} as unknown as ILoadOptionsFunctions;

	describe('searchUsers', () => {
		it('should return an empty result if no users are found', async () => {
			const responseData = { ListUsersResponse: { ListUsersResult: { Users: [] } } };
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchUsers.call(mockContext);
			expect(result.results).toEqual([]);
		});

		it('should return formatted user results when users are found', async () => {
			const responseData = {
				ListUsersResponse: {
					ListUsersResult: {
						Users: [{ UserName: 'user1' }, { UserName: 'user2' }],
					},
				},
			};
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchUsers.call(mockContext);
			expect(result.results).toEqual([
				{ name: 'user1', value: 'user1' },
				{ name: 'user2', value: 'user2' },
			]);
		});

		it('should apply filter to the user results', async () => {
			const responseData = {
				ListUsersResponse: {
					ListUsersResult: {
						Users: [{ UserName: 'user1' }, { UserName: 'user2' }],
					},
				},
			};
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchUsers.call(mockContext, 'user1');
			expect(result.results).toEqual([{ name: 'user1', value: 'user1' }]);
		});
	});

	describe('searchGroups', () => {
		it('should return an empty result if no groups are found', async () => {
			const responseData = { ListGroupsResponse: { ListGroupsResult: { Groups: [] } } };
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchGroups.call(mockContext);
			expect(result.results).toEqual([]);
		});

		it('should return formatted group results when groups are found', async () => {
			const responseData = {
				ListGroupsResponse: {
					ListGroupsResult: {
						Groups: [{ GroupName: 'group1' }, { GroupName: 'group2' }],
					},
				},
			};
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchGroups.call(mockContext);
			expect(result.results).toEqual([
				{ name: 'group1', value: 'group1' },
				{ name: 'group2', value: 'group2' },
			]);
		});

		it('should apply filter to the group results', async () => {
			const responseData = {
				ListGroupsResponse: {
					ListGroupsResult: {
						Groups: [{ GroupName: 'group1' }, { GroupName: 'group2' }],
					},
				},
			};
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchGroups.call(mockContext, 'group1');
			expect(result.results).toEqual([{ name: 'group1', value: 'group1' }]);
		});
	});

	describe('searchGroupsForUser', () => {
		it('should return empty if no user groups are found', async () => {
			mockContext.getNodeParameter = jest.fn().mockReturnValue('user1');

			// Mock empty response for ListGroups
			const responseData = {
				ListGroupsResponse: { ListGroupsResult: { Groups: [] } },
			};
			(awsApiRequest as jest.Mock).mockResolvedValue(responseData);

			const result = await searchGroupsForUser.call(mockContext);

			// Expect empty results
			expect(result.results).toEqual([]);
		});
	});
});
