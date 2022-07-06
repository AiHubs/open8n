import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';


export class SquarespaceOAuth2Api implements ICredentialType {
	name = 'squarespaceOAuth2Api';
	displayName = 'Squarespace OAuth2 API';
	documentationUrl = 'squarespace';
	extends = [
		'oAuth2Api',
	];
	properties: INodeProperties[] = [
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://login.squarespace.com/api/1/login/oauth/provider/authorize',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://login.squarespace.com/api/1/login/oauth/provider/tokens',
			required: true,
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'website.orders,website.orders.read,website.transactions.read,website.inventory,website.inventory.read,website.products,website.products.read',
		},
	];
}
