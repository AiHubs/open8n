/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-cycle */

import express = require('express');
import { v4 as uuid } from 'uuid';
import { URL } from 'url';
import { genSaltSync, hashSync } from 'bcryptjs';
import validator from 'validator';
import { IsNull, Not } from 'typeorm';
import { LoggerProxy as Logger } from 'n8n-workflow';

import { Db, ResponseHelper } from '../..';
import { N8nApp } from '../Interfaces';
import { validatePassword } from '../UserManagementHelper';
import * as UserManagementMailer from '../email';
import type { PasswordResetRequest } from '../../requests';
import { issueCookie } from '../auth/jwt';
import { getBaseUrl } from '../../GenericHelpers';
import config = require('../../../config');

export function passwordResetNamespace(this: N8nApp): void {
	/**
	 * Send a password reset email.
	 */
	this.app.post(
		`/${this.restEndpoint}/forgot-password`,
		ResponseHelper.send(async (req: PasswordResetRequest.Email) => {
			if (config.get('userManagement.emails.mode') === '') {
				throw new ResponseHelper.ResponseError(
					'Email sending must be set up in order to request a password reset email',
					undefined,
					500,
				);
			}

			const { email } = req.body;

			if (!email) {
				Logger.debug('Missing email in payload', { payload: req.body });
				throw new ResponseHelper.ResponseError('Email is mandatory', undefined, 400);
			}

			if (!validator.isEmail(email)) {
				Logger.debug('Invalid email in payload', { invalidEmail: email });
				throw new ResponseHelper.ResponseError('Invalid email address', undefined, 400);
			}

			// User should just be able to reset password if one is already present
			const user = await Db.collections.User!.findOne({ email, password: Not(IsNull()) });

			if (!user) {
				Logger.debug('User not found for email', { invalidEmail: email });
				return;
			}

			user.resetPasswordToken = uuid();

			const { id, firstName, lastName, resetPasswordToken } = user;

			await Db.collections.User!.update(id, { resetPasswordToken });

			const baseUrl = getBaseUrl();
			const url = new URL('/change-password', baseUrl);
			url.searchParams.append('userId', id);
			url.searchParams.append('token', resetPasswordToken);

			void UserManagementMailer.getInstance().passwordReset({
				email,
				firstName,
				lastName,
				passwordResetUrl: url.toString(),
				domain: baseUrl,
			});
		}),
	);

	/**
	 * Verify password reset token and user ID.
	 */
	this.app.get(
		`/${this.restEndpoint}/resolve-password-token`,
		ResponseHelper.send(async (req: PasswordResetRequest.Credentials) => {
			const { token: resetPasswordToken, userId: id } = req.query;

			if (!resetPasswordToken || !id) {
				Logger.debug('Missing password reset token or user ID in query string', {
					queryString: req.query,
				});
				throw new ResponseHelper.ResponseError('', undefined, 400);
			}

			const user = await Db.collections.User!.findOne({ resetPasswordToken, id });

			if (!user) {
				Logger.debug('User not found for user ID and reset password token', {
					queryString: req.query,
				});
				throw new ResponseHelper.ResponseError('', undefined, 404);
			}

			Logger.info('Password token resolved successfully', { userId: id });
		}),
	);

	/**
	 * Verify password reset token and user ID and update password.
	 */
	this.app.post(
		`/${this.restEndpoint}/change-password`,
		ResponseHelper.send(async (req: PasswordResetRequest.NewPassword, res: express.Response) => {
			const { token: resetPasswordToken, userId, password } = req.body;

			if (!resetPasswordToken || !userId || !password) {
				Logger.debug('User ID or password or reset password token missing from payload', {
					payload: req.body,
				});
				throw new ResponseHelper.ResponseError('Parameter missing', undefined, 400);
			}

			const validPassword = validatePassword(password);

			const user = await Db.collections.User!.findOne({ id: userId, resetPasswordToken });

			if (!user) {
				Logger.debug('User not found for user ID and reset password token', {
					userId: req.user.id,
					queryString: req.query,
				});
				throw new ResponseHelper.ResponseError('', undefined, 404);
			}

			await Db.collections.User!.update(userId, {
				password: hashSync(validPassword, genSaltSync(10)),
				resetPasswordToken: null,
			});

			Logger.info('User password updated successfully', { userId });

			await issueCookie(res, user);
		}),
	);
}
