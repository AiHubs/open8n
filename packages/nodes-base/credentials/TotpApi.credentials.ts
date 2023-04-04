import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class TotpApi implements ICredentialType {
	name = 'totpApi';

	displayName = 'TOTP API';

	documentationUrl = 'totp';

	properties: INodeProperties[] = [
		{
			displayName: 'Secret',
			name: 'secret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Secret key encoded in the QR code during setup. <a href="https://github.com/google/google-authenticator/wiki/Key-Uri-Format#secret">Learn more</a>.',
		},
		{
			displayName: 'Label',
			name: 'label',
			type: 'string',
			default: '',
			placeholder: 'e.g. GitHub:john-doe',
			description:
				'Identifier for the TOTP account, in the <code>issuer:username</code> format. <a href="https://github.com/google/google-authenticator/wiki/Key-Uri-Format#label">Learn more</a>.',
		},
	];
}
