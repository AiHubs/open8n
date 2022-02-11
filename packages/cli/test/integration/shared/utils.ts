import { randomBytes } from 'crypto';
import express = require('express');
import * as superagent from 'superagent';
import * as request from 'supertest';
import { URL } from 'url';
import bodyParser = require('body-parser');
import * as util from 'util';
import { createTestAccount } from 'nodemailer';

import config = require('../../../config');
import { AUTHLESS_ENDPOINTS, REST_PATH_SEGMENT } from './constants';
import { addRoutes as authMiddleware } from '../../../src/UserManagement/routes';
import { Db } from '../../../src';
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
	User,
} from '../../../src/databases/entities/User';
import { meNamespace as meEndpoints } from '../../../src/UserManagement/routes/me';
import { usersNamespace as usersEndpoints } from '../../../src/UserManagement/routes/users';
import { authenticationMethods as authEndpoints } from '../../../src/UserManagement/routes/auth';
import { ownerNamespace as ownerEndpoints } from '../../../src/UserManagement/routes/owner';
import { passwordResetNamespace as passwordResetEndpoints } from '../../../src/UserManagement/routes/passwordReset';
import { getConnection } from 'typeorm';
import { issueJWT } from '../../../src/UserManagement/auth/jwt';
import { N8nApp } from '../../../src/UserManagement/Interfaces';
import type { SmtpTestAccount } from './types';

/**
 * Get an SMTP test account from https://ethereal.email to test sending emails.
 */
export const getSmtpTestAccount = util.promisify<SmtpTestAccount>(createTestAccount);

export const isTestRun = process.argv[1].split('/').includes('jest');

const POPULAR_TOP_LEVEL_DOMAINS = ['com', 'org', 'net', 'io', 'edu'];

type EndpointNamespace = 'me' | 'users' | 'auth' | 'owner' | 'passwordReset';

/**
 * Initialize a test server to make requests to.
 *
 * @param namespaces Namespaces of endpoints to apply to the test server.
 * @param applyAuth Whether to apply auth middleware to the test server.
 */
export function initTestServer(
	{
		applyAuth,
		namespaces,
	}: {
		applyAuth: boolean;
		namespaces?: EndpointNamespace[];
	},
) {
	const testServer = {
		app: express(),
		restEndpoint: REST_PATH_SEGMENT,
	};

	testServer.app.use(bodyParser.json());
	testServer.app.use(bodyParser.urlencoded({ extended: true }));

	config.set('userManagement.jwtSecret', 'My JWT secret');
	config.set('userManagement.hasOwner', false);

	if (applyAuth) {
		authMiddleware.apply(testServer, [AUTHLESS_ENDPOINTS, REST_PATH_SEGMENT]);
	}

	if (namespaces) {
		const map: Readonly<Record<EndpointNamespace, (this: N8nApp) => void>> = {
			me: meEndpoints,
			users: usersEndpoints,
			auth: authEndpoints,
			owner: ownerEndpoints,
			passwordReset: passwordResetEndpoints,
		};

		for (const namespace of namespaces) {
			map[namespace].apply(testServer);
		}
	}

	return testServer.app;
}

export async function initTestDb() {
	await Db.init();
	await getConnection().runMigrations({ transaction: 'none' });
}

export async function truncateUserTable() {
	await getConnection().query('PRAGMA foreign_keys=OFF');
	await Db.collections.User!.clear();
	await getConnection().query('PRAGMA foreign_keys=ON');
}

export async function createAuthAgent(app: express.Application, user: User) {
	const agent = request.agent(app);
	agent.use(prefix(REST_PATH_SEGMENT));

	const { token } = await issueJWT(user);
	agent.jar.setCookie(`n8n-auth=${token}`);

	return agent;
}

export async function createAuthlessAgent(app: express.Application) {
	const agent = request.agent(app);
	agent.use(prefix(REST_PATH_SEGMENT));

	return agent;
}

/**
 * Plugin to prefix a path segment into a request URL pathname.
 *
 * Example:
 * http://127.0.0.1:62100/me/password → http://127.0.0.1:62100/rest/me/password
 */
export function prefix(pathSegment: string) {
	return function (request: superagent.SuperAgentRequest) {
		const url = new URL(request.url);

		// enforce consistency at call sites
		if (url.pathname[0] !== '/') {
			throw new Error('Pathname must start with a forward slash');
		}

		url.pathname = pathSegment + url.pathname;
		request.url = url.toString();

		return request;
	};
}

export async function getHasOwnerSetting() {
	const { value } = await Db.collections.Settings!.findOneOrFail({
		key: 'userManagement.hasOwner',
	});

	return Boolean(value);
}

/**
 * Extract the value (token) of the auth cookie in a response.
 */
export function getAuthToken(response: request.Response, authCookieName = 'n8n-auth') {
	const cookies: string[] = response.headers['set-cookie'];

	if (!cookies) {
		throw new Error("No 'set-cookie' header found in response");
	}

	const authCookie = cookies.find((c) => c.startsWith(`${authCookieName}=`));

	if (!authCookie) return undefined;

	const match = authCookie.match(new RegExp(`(^| )${authCookieName}=(?<token>[^;]+)`));

	if (!match || !match.groups) return undefined;

	return match.groups.token;
}

/**
 * Create a random string of random length between two limits, both inclusive.
 */
export function randomString(min: number, max: number) {
	const randomInteger = Math.floor(Math.random() * (max - min) + min) + 1;
	return randomBytes(randomInteger / 2).toString('hex');
}

const chooseRandomly = <T>(array: T[]) => array[Math.floor(Math.random() * array.length)];

export const randomValidPassword = () => randomString(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH);

export const randomInvalidPassword = () =>
	chooseRandomly([
		randomString(1, MIN_PASSWORD_LENGTH - 1),
		randomString(MAX_PASSWORD_LENGTH + 1, 100),
	]);

export const randomEmail = () => `${randomName()}@${randomName()}.${randomTopLevelDomain()}`;

const randomTopLevelDomain = () => chooseRandomly(POPULAR_TOP_LEVEL_DOMAINS);

export const randomName = () => randomString(3, 7);
