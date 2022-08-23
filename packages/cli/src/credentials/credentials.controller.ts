/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-cycle */
import express from 'express';
import { INodeCredentialTestResult, LoggerProxy } from 'n8n-workflow';

import config from '../../config';
import { getLogger } from '../Logger';
import { GenericHelpers, ResponseHelper } from '..';
import { CredentialsService } from './credentials.service';
import { EECredentialsController } from './credentials.controller.ee';

import type { ICredentialsDb, ICredentialsResponse } from '..';
import type { CredentialRequest } from '../requests';

export const credentialsController = express.Router();

/**
 * Initialize Logger if needed
 */
credentialsController.use((req, res, next) => {
	try {
		LoggerProxy.getInstance();
	} catch (error) {
		LoggerProxy.init(getLogger());
	}
	next();
});

credentialsController.use('/', EECredentialsController);

/**
 * GET /credentials
 */
credentialsController.get(
	'/',
	ResponseHelper.send(async (req: CredentialRequest.GetAll): Promise<ICredentialsResponse[]> => {
		let credentials: ICredentialsDb[] | undefined;

		try {
			credentials = await CredentialsService.getManyWithPermissions(req.user);
		} catch (error) {
			LoggerProxy.error('Request to list credentials failed', error as Error);
			throw error;
		}

		// @TODO_TECH_DEBT: Stringify `id` with entity field transformer
		return credentials.map((credential) => {
			// eslint-disable-next-line no-param-reassign
			credential.id = credential.id.toString();
			return credential as ICredentialsResponse;
		});
	}),
);

/**
 * GET /credentials/new
 *
 * Generate a unique credential name.
 */
credentialsController.get(
	'/new',
	ResponseHelper.send(async (req: CredentialRequest.NewName): Promise<{ name: string }> => {
		const { name: newName } = req.query;

		return {
			name: await GenericHelpers.generateUniqueName(
				newName ?? config.getEnv('credentials.defaultName'),
				'credentials',
			),
		};
	}),
);

/**
 * POST /credentials/test
 *
 * Test if a credential is valid.
 */
credentialsController.post(
	'/test',
	ResponseHelper.send(async (req: CredentialRequest.Test): Promise<INodeCredentialTestResult> => {
		const { credentials, nodeToTestWith } = req.body;

		const encryptionKey = await CredentialsService.getEncryptionKey();
		return CredentialsService.test(req.user, encryptionKey, credentials, nodeToTestWith);
	}),
);

/**
 * POST /credentials
 */
credentialsController.post(
	'/',
	ResponseHelper.send(async (req: CredentialRequest.Create) => {
		const newCredential = await CredentialsService.prepareCreateData(req.body);

		const key = await CredentialsService.getEncryptionKey();
		const encryptedData = CredentialsService.createEncryptedData(key, null, newCredential);
		const { id, ...rest } = await CredentialsService.save(newCredential, encryptedData, req.user);

		return { id: id.toString(), ...rest };
	}),
);

/**
 * DELETE /credentials/:id
 */
credentialsController.delete(
	'/:id',
	ResponseHelper.send(async (req: CredentialRequest.Delete) => {
		const { id: credentialId } = req.params;

		const sharing = await CredentialsService.getSharing(req.user, credentialId);

		if (!sharing) {
			LoggerProxy.info('Attempt to delete credential blocked due to lack of permissions', {
				credentialId,
				userId: req.user.id,
			});
			throw new ResponseHelper.ResponseError(
				`Credential with ID "${credentialId}" could not be found to be deleted.`,
				undefined,
				404,
			);
		}

		const { credentials: credential } = sharing;

		await CredentialsService.delete(credential);

		return true;
	}),
);

/**
 * PATCH /credentials/:id
 */
credentialsController.patch(
	'/:id',
	ResponseHelper.send(async (req: CredentialRequest.Update): Promise<ICredentialsResponse> => {
		const { id: credentialId } = req.params;

		const sharing = await CredentialsService.getSharing(req.user, credentialId);

		if (!sharing) {
			LoggerProxy.info('Attempt to update credential blocked due to lack of permissions', {
				credentialId,
				userId: req.user.id,
			});
			throw new ResponseHelper.ResponseError(
				`Credential with ID "${credentialId}" could not be found to be updated.`,
				undefined,
				404,
			);
		}

		const { credentials: credential } = sharing;

		const key = await CredentialsService.getEncryptionKey();
		const decryptedData = await CredentialsService.decrypt(key, credential);
		const preparedCredentialData = await CredentialsService.prepareUpdateData(
			req.body,
			decryptedData,
		);
		const newCredentialData = CredentialsService.createEncryptedData(
			key,
			credentialId,
			preparedCredentialData,
		);

		const responseData = await CredentialsService.update(credentialId, newCredentialData);

		if (responseData === undefined) {
			throw new ResponseHelper.ResponseError(
				`Credential ID "${credentialId}" could not be found to be updated.`,
				undefined,
				404,
			);
		}

		// Remove the encrypted data as it is not needed in the frontend
		const { id, data: _, ...rest } = responseData;

		LoggerProxy.verbose('Credential updated', { credentialId });

		return {
			id: id.toString(),
			...rest,
		};
	}),
);

/**
 * GET /credentials/:id
 */
credentialsController.get(
	'/:id',
	ResponseHelper.send(async (req: CredentialRequest.Get) => {
		const { id: credentialId } = req.params;
		const includeDecryptedData = req.query.includeData === 'true';

		const sharing = await CredentialsService.getSharing(req.user, credentialId, [
			'credentials',
			'role',
		]);

		if (!sharing) {
			throw new ResponseHelper.ResponseError(
				`Credential with ID "${credentialId}" could not be found.`,
				undefined,
				404,
			);
		}

		const { credentials: credential } = sharing;

		const userIsEditor =
			sharing.credentialId.toString() === credentialId && sharing.role.name === 'editor';

		// @TODO_TECH_DEBT: Stringify `id` with entity field transformer

		if (!includeDecryptedData || userIsEditor) {
			const { id, data: _, ...rest } = credential;

			return { id: id.toString(), ...rest };
		}

		const { id, data: _, ...rest } = credential;

		const key = await CredentialsService.getEncryptionKey();
		const decryptedData = await CredentialsService.decrypt(key, credential);

		return { id: id.toString(), data: decryptedData, ...rest };
	}),
);
