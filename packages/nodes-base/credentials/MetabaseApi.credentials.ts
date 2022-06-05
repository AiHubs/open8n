import {
	IAuthenticateHeaderAuth,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
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
							typeOptions: {
								expirable: true,
							},
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

	// method will only be called if "sessionToken" (the expirable property)
	// is empty or is expired
	async preAuthentication(
			this: IHttpRequestHelper,
			credentials: ICredentialDataDecryptedObject) {
				//make reques to get session token
				const { id } = await this.helpers.httpRequest({
						method: 'POST',
						url: `${credentials.url}/api/session`,
						body: {
								username: credentials.username,
								password: credentials.password,
						}
				}) as { id: string }
				console.log(`SESSION TOKEN: ${id}`)
				return { sessionToken: id };
	}
	authenticate: IAuthenticateHeaderAuth = {
		type: 'headerAuth',
		properties: {
			name: 'X-Metabase-Session',
			value: '={{$credentials.sessionToken}}',
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.url}}',
			url: '/api/activity/',
		},
	}}
