import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import nock from 'nock';

import { equalityTest, workflowToTests } from '@test/nodes/Helpers';
import { CredentialsHelper } from '@test/nodes/credentials-helper';

describe('Microsoft SharePoint Node', () => {
	const workflows = ['nodes/Microsoft/SharePoint/test/credentials/oauth2.workflow.json'];
	const workflowTests = workflowToTests(workflows);

	beforeAll(() => {
		nock.disableNetConnect();

		jest
			.spyOn(CredentialsHelper.prototype, 'authenticate')
			.mockImplementation(
				async (
					credentials: ICredentialDataDecryptedObject,
					typeName: string,
					requestParams: IHttpRequestOptions,
				): Promise<IHttpRequestOptions> => {
					if (typeName === 'microsoftSharePointOAuth2Api') {
						return {
							...requestParams,
							headers: {
								authorization: `bearer ${(credentials.oauthTokenData as IDataObject).access_token as string}`,
							},
						};
					} else {
						return requestParams;
					}
				},
			);
	});

	afterAll(() => {
		nock.restore();
		jest.restoreAllMocks();
	});

	for (const workflow of workflowTests) {
		workflow.nock = {
			baseUrl: 'https://mydomain.sharepoint.com/_api/v2.0',
			mocks: [
				{
					method: 'get',
					path: '/sites/site1/lists/list1?%24select=id%2Cname%2CdisplayName%2Cdescription%2CcreatedDateTime%2ClastModifiedDateTime%2CwebUrl',
					statusCode: 200,
					requestHeaders: { authorization: 'bearer ACCESSTOKEN' },
					responseBody: {
						'@odata.context':
							'https://mydomain.sharepoint.com/sites/site1/_api/v2.0/$metadata#lists/$entity',
						'@odata.etag': '"58a279af-1f06-4392-a5ed-2b37fa1d6c1d,5"',
						createdDateTime: '2025-03-12T19:38:40Z',
						description: 'My List 1',
						id: '58a279af-1f06-4392-a5ed-2b37fa1d6c1d',
						lastModifiedDateTime: '2025-03-12T22:18:18Z',
						name: 'list1',
						webUrl: 'https://mydomain.sharepoint.com/sites/site1/Lists/name%20list',
						displayName: 'list1',
					},
				},
			],
		};

		test(workflow.description, async () => await equalityTest(workflow));
	}
});
