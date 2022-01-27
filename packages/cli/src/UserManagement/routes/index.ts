/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable import/no-cycle */
import cookieParser = require('cookie-parser');
import * as passport from 'passport';
import { Strategy } from 'passport-jwt';
import { NextFunction, Request, Response } from 'express';
import { genSaltSync, hashSync } from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { JwtPayload, N8nApp } from '../Interfaces';
import { authenticationMethods } from './auth';
import config = require('../../../config');
import { Db, ResponseHelper } from '../..';
import { User } from '../../databases/entities/User';
import { isValidEmail, sanitizeUser, validatePassword } from '../UserManagementHelper';
import { issueCookie, issueJWT } from '../auth/jwt';
import { meNamespace } from './me';
import { usersNamespace } from './users';
import { passwordResetNamespace } from './passwordReset';
import { AuthenticatedRequest } from '../../requests';

export async function addRoutes(
	this: N8nApp,
	ignoredEndpoints: string[],
	restEndpoint: string,
): Promise<void> {
	this.app.use(cookieParser());

	const options = {
		jwtFromRequest: (req: Request) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			return (req.cookies?.['n8n-auth'] as string | undefined) ?? null;
		},
		secretOrKey: config.get('userManagement.jwtSecret') as string,
	};

	passport.use(
		new Strategy(options, async function validateCookieContents(jwtPayload: JwtPayload, done) {
			// We will assign the `sub` property on the JWT to the database ID of user
			const user = await Db.collections.User!.findOne(jwtPayload.id, { relations: ['globalRole'] });

			let passwordHash = null;
			if (user?.password) {
				passwordHash = createHash('sha256')
					.update(user.password.slice(user.password.length / 2))
					.digest('hex');
			}

			if (!user || jwtPayload.password !== passwordHash || user.email !== jwtPayload.email) {
				// When owner hasn't been set up, the default user
				// won't have email nor password (both equals null)
				return done(null, false, { message: 'User not found' });
			}
			return done(null, user);
		}),
	);

	this.app.use(passport.initialize());

	this.app.use((req: Request, res: Response, next: NextFunction) => {
		if (
			req.url.includes('login') ||
			req.url.includes('logout') ||
			req.url === '/index.html' ||
			req.url.startsWith('/css/') ||
			req.url.startsWith('/js/') ||
			req.url.startsWith('/fonts/') ||
			req.url.startsWith(`/${restEndpoint}/settings`) ||
			req.url.startsWith(`/${restEndpoint}/resolve-signup-token`) ||
			req.url === `/${restEndpoint}/user`
		) {
			return next();
		}

		for (let i = 0; i < ignoredEndpoints.length; i++) {
			const path = ignoredEndpoints[i];
			if (!path) {
				// Skip empty paths (they might exist)
				// eslint-disable-next-line no-continue
				continue;
			}
			if (req.url.includes(path)) {
				return next();
			}
		}
		return passport.authenticate('jwt', { session: false })(req, res, next);
	});

	this.app.use((req: Request, res: Response, next: NextFunction) => {
		// req.user is empty for public routes, so just proceed
		// owner can do anything, so proceed as well
		if (req.user === undefined || (req.user && (req.user as User).globalRole.name === 'owner')) {
			next();
			return;
		}

		// Not owner and user exists. We now protect restricted urls.
		const postRestrictedUrls = [`/${this.restEndpoint}/users`];
		const getRestrictedUrls = [`/${this.restEndpoint}/users`];
		const trimmedUrl = req.url.endsWith('/') ? req.url.slice(0, -1) : req.url;
		if (
			(req.method === 'POST' && postRestrictedUrls.includes(trimmedUrl)) ||
			(req.method === 'GET' && getRestrictedUrls.includes(trimmedUrl)) ||
			(req.method === 'DELETE' &&
				new RegExp(`/${restEndpoint}/users/[^/]+`, 'gm').test(trimmedUrl)) ||
			(req.method === 'POST' &&
				new RegExp(`/${restEndpoint}/users/[^/]/reinvite+`, 'gm').test(trimmedUrl))
		) {
			res.status(403).json({ status: 'error', message: 'Unauthorized' });
			return;
		}

		next();
	});

	// middleware to refresh cookie before it expires
	this.app.use(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		const cookieAuth = options.jwtFromRequest(req);
		if (cookieAuth && req.user) {
			const cookieContents = jwt.decode(cookieAuth) as JwtPayload & { exp: number };
			if (cookieContents.exp * 1000 - Date.now() < 259200000) {
				// if cookie expires in < 3 days, renew it.
				await issueCookie(res, req.user);
			}
		}
		next();
	});

	authenticationMethods.apply(this);
	meNamespace.apply(this);
	passwordResetNamespace.apply(this);
	usersNamespace.apply(this);

	// ----------------------------------------
	// Temporary code below - must be refactored
	// and moved from here.
	// ----------------------------------------

	// ----------------------------------------
	// Create instance owner
	// ----------------------------------------

	this.app.post(
		`/${this.restEndpoint}/owner-setup`,
		ResponseHelper.send(async (req: Request, res: Response) => {
			if (config.get('userManagement.hasOwner') === true) {
				throw new Error('Invalid request');
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (!req.body.email || !isValidEmail(req.body.email)) {
				throw new Error('Invalid email address');
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (!req.body.firstName || !req.body.lastName) {
				throw new Error('First and last names are mandatory');
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (!req.body.password || !validatePassword(req.body.password)) {
				throw new Error('Password does not comply to security standards');
			}

			const role = await Db.collections.Role!.findOneOrFail({ name: 'owner', scope: 'global' });

			const newUser = {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				email: req.body.email,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				firstName: req.body.firstName,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				lastName: req.body.lastName,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				password: hashSync(req.body.password, genSaltSync(10)),
				globalRole: role,
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				id: req.user.id,
			};

			const owner = await Db.collections.User!.save(newUser);
			config.set('userManagement.hasOwner', true);
			await Db.collections.Settings!.update(
				{
					key: 'userManagement.hasOwner',
				},
				{
					value: JSON.stringify(true),
				},
			);

			const userData = await issueJWT(owner);
			res.cookie('n8n-auth', userData.token, { maxAge: userData.expiresIn, httpOnly: true });
			return sanitizeUser(owner);
		}),
	);
}
