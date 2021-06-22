import {
	INodeProperties,
} from 'n8n-workflow';

import { userCreateDescription } from './create';
import { userDeactivateDescription } from './deactivate';
import { userInviteDescription } from './invite';
import { userGetAllDescription } from './getAll';
import { userGetByEmailDescription } from './getByEmail';
import { userGetByIdDescription } from './getById';


const userDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		displayOptions: {
			show: {
				resource: [
					'user',
				],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new user',
			},
			{
				name: 'Deactive',
				value: 'deactive',
				description: 'Deactivates the user and revokes all its sessions by archiving its user object.',
			},
			{
				name: 'Get All',
				value: 'getAll',
				description: 'Retrieve all users',
			},
			{
				name: 'Get By Email',
				value: 'getByEmail',
				description: 'Get a user by email',
			},
			{
				name: 'Get By ID',
				value: 'getById',
				description: 'Get a user by id',
			},
			{
				name: 'Invite',
				value: 'invite',
				description: 'Invite user to team',
			},
		],
		default: '',
		description: 'The operation to perform.',
	},
	...userCreateDescription,
	...userDeactivateDescription,
	...userInviteDescription,
	...userGetAllDescription,
	...userGetByEmailDescription,
	...userGetByIdDescription,
];

export { userDescription };