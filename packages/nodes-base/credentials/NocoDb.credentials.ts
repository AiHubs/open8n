import {
	IAuthenticateHeaderAuth,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';


export class NocoDb implements ICredentialType {
	name = 'nocoDb';
	displayName = 'NocoDB';
	documentationUrl = 'nocoDb';
	properties: INodeProperties[] = [
		{
			displayName: 'User Token',
			name: 'apiToken',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'http(s)://localhost:8080',
		},
	];

	authenticate: IAuthenticateHeaderAuth = {
		type: 'headerAuth',
		properties: {
			name: 'xc-auth',
			value: '={{$credentials.apiToken}}',
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.host}}',
			url: '/user/me',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'isAuthorized',
					value: false,
					message: 'Invalid API Token',
				},
			},
		],
	};

}
