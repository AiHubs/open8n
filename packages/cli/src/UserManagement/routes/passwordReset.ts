/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-cycle */

import express = require('express');
import { v4 as uuid } from 'uuid';
import { URL } from 'url';
import { genSaltSync, hashSync } from 'bcryptjs';
import validator from 'validator';
import { IsNull, MoreThanOrEqual, Not } from 'typeorm';

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
				throw new ResponseHelper.ResponseError('Email is mandatory', undefined, 400);
			}

			if (!validator.isEmail(email)) {
				throw new ResponseHelper.ResponseError('Invalid email address', undefined, 400);
			}

			// User should just be able to reset password if one is already present
			const user = await Db.collections.User!.findOne({ email, password: Not(IsNull()) });

			if (!user || !user.password) {
				return;
			}

			user.resetPasswordToken = uuid();

			const { id, firstName, lastName, resetPasswordToken } = user;

			const resetPasswordTokenExpiration = Math.floor(Date.now() / 1000) + 7200;

			await Db.collections.User!.update(id, { resetPasswordToken, resetPasswordTokenExpiration });

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
				throw new ResponseHelper.ResponseError('', undefined, 400);
			}

			// Timestamp is saved in seconds
			const currentTimestamp = Math.floor(Date.now() / 1000);

			const user = await Db.collections.User!.findOne({
				id,
				resetPasswordToken,
				resetPasswordTokenExpiration: MoreThanOrEqual(currentTimestamp),
			});

			if (!user) {
				throw new ResponseHelper.ResponseError('', undefined, 404);
			}
		}),
	);

	/**
	 * Verify password reset token and user ID and update password.
	 */
	this.app.post(
		`/${this.restEndpoint}/change-password`,
		ResponseHelper.send(async (req: PasswordResetRequest.NewPassword, res: express.Response) => {
			const { token: resetPasswordToken, userId: id, password } = req.body;

			if (!resetPasswordToken || !id || !password) {
				throw new ResponseHelper.ResponseError('Parameter missing', undefined, 400);
			}

			const validPassword = validatePassword(password);

			// Timestamp is saved in seconds
			const currentTimestamp = Math.floor(Date.now() / 1000);

			const user = await Db.collections.User!.findOne({
				id,
				resetPasswordToken,
				resetPasswordTokenExpiration: MoreThanOrEqual(currentTimestamp),
			});

			if (!user) {
				throw new ResponseHelper.ResponseError('', undefined, 404);
			}

			await Db.collections.User!.update(id, {
				password: hashSync(validPassword, genSaltSync(10)),
				resetPasswordToken: null,
				resetPasswordTokenExpiration: null,
			});

			await issueCookie(res, user);
		}),
	);
}
