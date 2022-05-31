import {
	ICredentialDataDecryptedObject,
	ICredentialType,
	IHttpRequestHelper,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class MetabaseApi implements ICredentialType {
	name = 'metabaseApi';
	displayName = 'Metabase API';
	documentationUrl = 'metabase';
	properties: INodeProperties[] = [
					{
							displayName: 'Session Token',
							name: 'sessionToken',
							type: 'hidden',
							default: '',
					},
					{
							displayName: 'URL',
							name: 'url',
							type: 'string',
							default: '',
					},
					{
							displayName: 'Username',
							name: 'username',
							type: 'string',
							default: '',
					},
					{
							displayName: 'Password',
							name: 'password',
							type: 'string',
							typeOptions: {
									password: true,
							},
							default: '',
					},
	];
	async preAuthentication(
			this: IHttpRequestHelper,
			credentials: ICredentialDataDecryptedObject,
			forcedRefresh: boolean) {
					if (!forcedRefresh && credentials.sessionToken) {
							return {};
					}
					//make reques to get session token
					const { id } = await this.helpers.httpRequest({
							method: 'POST',
							url: `${credentials.url}/api/session`,
							body: {
									username: credentials.username,
									password: credentials.password,
							}
					}) as { id: string }

					return { sessionToken: id};
	}

	async authenticate(credentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions): Promise<IHttpRequestOptions> {
			requestOptions.headers!['X-Metabase-Session'] = credentials.sessionToken
			return requestOptions;
	}
}
