/* eslint-disable @typescript-eslint/no-unsafe-argument */
import express from 'express';

import type { ICredentialsDb } from '@/Interfaces';
import { CredentialsHelper } from '@/CredentialsHelper';
import { CredentialTypes } from '@/CredentialTypes';
import { CredentialsEntity } from '@db/entities/CredentialsEntity';
import { CredentialRequest } from '@/requests';
import { CredentialTypeRequest, CredentialRequest as CredentialPublicRequest } from '../../../types';
import { FindManyOptions } from 'typeorm';
import { authorize, validCursor } from '../../shared/middlewares/global.middleware';
import { encodeNextCursor } from '../../shared/services/pagination.service';
import { validCredentialsProperties, validCredentialType } from './credentials.middleware';

import {
	createCredential,
	encryptCredential,
	getCredentials,
	getAllCredentials,
	countCredentials,
	getSharedCredentials,
	removeCredential,
	sanitizeCredentials,
	saveCredential,
	toJsonSchema,
} from './credentials.service';

export = {
	createCredential: [
		authorize(['owner', 'member']),
		validCredentialType,
		validCredentialsProperties,
		async (
			req: CredentialRequest.Create,
			res: express.Response,
		): Promise<express.Response<Partial<CredentialsEntity>>> => {
			try {
				const newCredential = await createCredential(req.body);

				const encryptedData = await encryptCredential(newCredential);

				Object.assign(newCredential, encryptedData);

				const savedCredential = await saveCredential(newCredential, req.user, encryptedData);

				// LoggerProxy.verbose('New credential created', {
				// 	credentialId: newCredential.id,
				// 	ownerId: req.user.id,
				// });

				return res.json(sanitizeCredentials(savedCredential));
			} catch ({ message, httpStatusCode }) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				return res.status(httpStatusCode ?? 500).json({ message });
			}
		},
	],
	deleteCredential: [
		authorize(['owner', 'member']),
		async (
			req: CredentialRequest.Delete,
			res: express.Response,
		): Promise<express.Response<Partial<CredentialsEntity>>> => {
			const { id: credentialId } = req.params;
			let credential: CredentialsEntity | undefined;

			if (req.user.globalRole.name !== 'owner') {
				const shared = await getSharedCredentials(req.user.id, credentialId, [
					'credentials',
					'role',
				]);

				if (shared?.role.name === 'owner') {
					credential = shared.credentials;
				}
			} else {
				credential = (await getCredentials(credentialId)) as CredentialsEntity;
			}

			if (!credential) {
				return res.status(404).json({ message: 'Not Found' });
			}

			await removeCredential(credential);
			credential.id = Number(credentialId);

			return res.json(sanitizeCredentials(credential));
		},
	],

	getCredentialType: [
		authorize(['owner', 'member']),
		async (req: CredentialTypeRequest.Get, res: express.Response): Promise<express.Response> => {
			const { credentialTypeName } = req.params;

			try {
				CredentialTypes().getByName(credentialTypeName);
			} catch (error) {
				return res.status(404).json({ message: 'Not Found' });
			}

			const schema = new CredentialsHelper('')
				.getCredentialsProperties(credentialTypeName)
				.filter((property) => property.type !== 'hidden');

			return res.json(toJsonSchema(schema));
		},
	],
	getCredentials: [
		authorize(['owner', 'member']),
		validCursor,
		async (req: CredentialPublicRequest.GetAll, res: express.Response): Promise<express.Response> => {
			const { offset = 0, limit = 100} = req.query;
			// TODO - what if the user is not the instance owner

			const query: FindManyOptions<ICredentialsDb> = {
				skip: offset,
				take: limit,
			}

			const credentials = <CredentialsEntity[]>(await getAllCredentials(query));
			const count : number = await countCredentials(query);

			return res.json({
				data: sanitizeCredentials(credentials),
				nextCursor: encodeNextCursor({
					offset,
					limit,
					numberOfTotalRecords: count,
				}),
			});
		},
	],
};
