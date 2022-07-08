import {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class ElasticsearchApi implements ICredentialType {
	name = 'elasticsearchApi';
	displayName = 'Elasticsearch API';
	documentationUrl = 'elasticsearch';
	properties: INodeProperties[] = [
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
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://mydeployment.es.us-central1.gcp.cloud.es.io:9243',
			description: 'Referred to as Elasticsearch \'endpoint\' in the Elastic deployment dashboard',
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'ignoreSSLIssues',
			type: 'boolean',
			default: false,
		},
	];
	async authenticate(credentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions): Promise<IHttpRequestOptions> {
		requestOptions.auth = {
			username: credentials.username as string,
			password: credentials.password as string,
		};
		requestOptions.skipSslCertificateValidation = credentials.ignoreSSLIssues as boolean;
		return requestOptions;
	}
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			auth: {
				username: '=${{credentias.username}}',
				password: '=${{credentials.password}}',
			},
			url: '',
		},
	};}
