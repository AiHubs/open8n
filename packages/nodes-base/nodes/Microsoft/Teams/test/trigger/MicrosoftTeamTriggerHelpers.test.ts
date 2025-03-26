import { mock } from 'jest-mock-extended';
import { NodeApiError } from 'n8n-workflow';

import {
	fetchAllTeams,
	fetchAllChannels,
	fetchAllChats,
	createSubscription,
	getResourcePath,
} from '../../MicrosoftTeamsTriggerHelpers.node';
import { microsoftApiRequest } from '../../v2/transport';

jest.mock('../../v2/transport', () => ({
	microsoftApiRequest: {
		call: jest.fn(),
	},
}));

describe('Microsoft Teams Helpers Functions', () => {
	let mockLoadOptionsFunctions: any;
	let mockHookFunctions: any;

	beforeEach(() => {
		mockLoadOptionsFunctions = mock();
		mockHookFunctions = mock();
		jest.clearAllMocks();
	});

	describe('fetchAllTeams', () => {
		it('should fetch all teams and map them correctly', async () => {
			(microsoftApiRequest.call as jest.Mock).mockResolvedValue({
				value: [
					{ id: 'team1', displayName: 'Team 1' },
					{ id: 'team2', displayName: 'Team 2' },
				],
			});

			const result = await fetchAllTeams.call(mockLoadOptionsFunctions);

			expect(result).toEqual([
				{ id: 'team1', displayName: 'Team 1' },
				{ id: 'team2', displayName: 'Team 2' },
			]);
			expect(microsoftApiRequest.call).toHaveBeenCalledWith(
				mockLoadOptionsFunctions,
				'GET',
				'/v1.0/me/joinedTeams',
			);
		});

		it('should throw an error if getTeams fails', async () => {
			(microsoftApiRequest.call as jest.Mock).mockRejectedValue(new Error('Failed to fetch teams'));

			await expect(fetchAllTeams.call(mockLoadOptionsFunctions)).rejects.toThrow(
				'Failed to fetch teams',
			);
		});
	});

	describe('fetchAllChannels', () => {
		it('should fetch all channels for a team and map them correctly', async () => {
			(microsoftApiRequest.call as jest.Mock).mockResolvedValue({
				value: [
					{ id: 'channel1', displayName: 'Channel 1' },
					{ id: 'channel2', displayName: 'Channel 2' },
				],
			});

			const result = await fetchAllChannels.call(mockLoadOptionsFunctions, 'team1');

			expect(result).toEqual([
				{ id: 'channel1', displayName: 'Channel 1' },
				{ id: 'channel2', displayName: 'Channel 2' },
			]);
			expect(microsoftApiRequest.call).toHaveBeenCalledWith(
				mockLoadOptionsFunctions,
				'GET',
				'/v1.0/teams/team1/channels',
			);
		});

		it('should throw an error if getChannels fails', async () => {
			(microsoftApiRequest.call as jest.Mock).mockRejectedValue(
				new Error('Failed to fetch channels'),
			);

			await expect(fetchAllChannels.call(mockLoadOptionsFunctions, 'team1')).rejects.toThrow(
				'Failed to fetch channels',
			);
		});
	});

	describe('fetchAllChats', () => {
		it('should fetch all chats and map them correctly', async () => {
			(microsoftApiRequest.call as jest.Mock).mockResolvedValue({
				value: [
					{ id: 'chat1', topic: 'Chat 1', webUrl: 'https://teams.microsoft.com/chat1' },
					{ id: 'chat2', topic: 'Chat 2', webUrl: 'https://teams.microsoft.com/chat2' },
				],
			});

			const result = await fetchAllChats.call(mockLoadOptionsFunctions);

			expect(result).toEqual([
				{ id: 'chat1', displayName: 'Chat 1', url: 'https://teams.microsoft.com/chat1' },
				{ id: 'chat2', displayName: 'Chat 2', url: 'https://teams.microsoft.com/chat2' },
			]);
			expect(microsoftApiRequest.call).toHaveBeenCalledWith(
				mockLoadOptionsFunctions,
				'GET',
				'/v1.0/chats',
			);
		});

		it('should throw an error if getChats fails', async () => {
			(microsoftApiRequest.call as jest.Mock).mockRejectedValue(new Error('Failed to fetch chats'));

			await expect(fetchAllChats.call(mockLoadOptionsFunctions)).rejects.toThrow(
				'Failed to fetch chats',
			);
		});
	});

	describe('createSubscription', () => {
		it('should create a subscription and return the subscription ID', async () => {
			(microsoftApiRequest.call as jest.Mock).mockResolvedValue({ id: 'subscription123' });

			const result = await createSubscription.call(
				mockHookFunctions,
				'https://webhook.url',
				'/resource/path',
			);

			expect(result).toBe('subscription123');
			expect(microsoftApiRequest.call).toHaveBeenCalledWith(
				mockHookFunctions,
				'POST',
				'/v1.0/subscriptions',
				expect.objectContaining({
					changeType: 'created',
					notificationUrl: 'https://webhook.url',
					resource: '/resource/path',
					expirationDateTime: expect.any(String),
					latestSupportedTlsVersion: 'v1_2',
					lifecycleNotificationUrl: 'https://webhook.url',
				}),
			);
		});

		it('should throw a NodeApiError if the API request fails', async () => {
			const error = new Error('API request failed');
			(microsoftApiRequest.call as jest.Mock).mockRejectedValue(error);

			await expect(
				createSubscription.call(mockHookFunctions, 'https://webhook.url', '/resource/path'),
			).rejects.toThrow(NodeApiError);
		});
	});

	describe('getResourcePath', () => {
		it('should return the correct resource path for newChat event', async () => {
			const result = await getResourcePath.call(mockHookFunctions, 'newChat');
			expect(result).toBe('/me/chats');
		});

		it('should return the correct resource path for newChatMessage event with watchAllChats', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(true);
			const result = await getResourcePath.call(mockHookFunctions, 'newChatMessage');
			expect(result).toBe('/me/chats/getAllMessages');
		});

		it('should return the correct resource path for newChatMessage event with chatId', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(false).mockReturnValueOnce('chat123');

			const result = await getResourcePath.call(mockHookFunctions, 'newChatMessage');
			expect(result).toBe('/chats/chat123/messages');
		});

		it('should throw a NodeApiError for newChatMessage if chatId is missing', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(false).mockReturnValueOnce(undefined);

			await expect(getResourcePath.call(mockHookFunctions, 'newChatMessage')).rejects.toThrow(
				'Chat ID is required',
			);
		});

		it('should return the correct resource path for newChannel event', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(false);
			mockHookFunctions.getNodeParameter.mockReturnValueOnce('team123');

			const result = await getResourcePath.call(mockHookFunctions, 'newChannel');
			expect(result).toBe('/teams/team123/channels');
		});

		it('should throw a NodeApiError for newChannel if teamId is missing', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(undefined);

			await expect(getResourcePath.call(mockHookFunctions, 'newChannel')).rejects.toThrow(
				'Team ID is required',
			);
		});

		it('should return the correct resource path for newChannelMessage event with a specific team and channel', async () => {
			mockHookFunctions.getNodeParameter
				.mockReturnValueOnce(false)
				.mockReturnValueOnce('team123')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce('channel123');

			const result = await getResourcePath.call(mockHookFunctions, 'newChannelMessage');
			expect(result).toBe('/teams/team123/channels/channel123/messages');
		});

		it('should return the correct resource path for newTeamMember event', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(false);
			mockHookFunctions.getNodeParameter.mockReturnValueOnce('team123');

			const result = await getResourcePath.call(mockHookFunctions, 'newTeamMember');
			expect(result).toBe('/teams/team123/members');
		});

		it('should throw a NodeApiError for newTeamMember if teamId is missing', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(undefined);

			await expect(getResourcePath.call(mockHookFunctions, 'newTeamMember')).rejects.toThrow(
				'Team ID is required',
			);
		});

		it('should return the correct resource path for newTeamMember event with watchAllTeams', async () => {
			mockHookFunctions.getNodeParameter.mockReturnValueOnce(true);

			(microsoftApiRequest.call as jest.Mock).mockResolvedValueOnce({
				value: [
					{ id: 'team1', displayName: 'Team 1' },
					{ id: 'team2', displayName: 'Team 2' },
				],
			});

			const result = await getResourcePath.call(mockHookFunctions, 'newTeamMember');
			expect(result).toEqual(['/teams/team1/members', '/teams/team2/members']);
		});
	});
});
