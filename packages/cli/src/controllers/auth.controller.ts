import validator from 'validator';
import { Get, Post, RestController } from '@/decorators';
import { AuthError, BadRequestError, InternalServerError } from '@/ResponseHelper';
import { compareHash, sanitizeUser } from '@/UserManagement/UserManagementHelper';
import { issueCookie, resolveJwt } from '@/UserManagement/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/constants';
import type { Request, Response } from 'express';
import type { ILogger } from 'n8n-workflow';
import type { User } from '@db/entities/User';
import type { LoginRequest, UserRequest } from '@/requests';
import type { PublicUser } from '@/UserManagement/Interfaces';
import { In, Repository } from 'typeorm';
import type { Config } from '@/config';
import type { IInternalHooksClass } from '@/Interfaces';

@RestController()
export class AuthController {
	constructor(
		private config: Config,
		private internalHooks: IInternalHooksClass,
		private userRepository: Repository<User>,
		private logger: ILogger,
	) {}

	/**
	 * Log in a user.
	 * Authless endpoint.
	 */
	@Post('/login')
	async login(req: LoginRequest, res: Response): Promise<PublicUser> {
		const { email, password } = req.body;
		if (!email) {
			throw new Error('Email is required to log in');
		}

		if (!password) {
			throw new Error('Password is required to log in');
		}

		let user: User | undefined;
		try {
			user = await this.userRepository.findOne(
				{ email },
				{
					relations: ['globalRole'],
				},
			);
		} catch (error) {
			throw new Error('Unable to access database.');
		}

		if (!user?.password || !(await compareHash(req.body.password, user.password))) {
			throw new AuthError('Wrong username or password. Do you have caps lock on?');
		}

		await issueCookie(res, user);

		return sanitizeUser(user);
	}

	/**
	 * Manually check the `n8n-auth` cookie.
	 */
	@Get('/login')
	async currentUser(req: Request, res: Response): Promise<PublicUser> {
		// Manually check the existing cookie.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const cookieContents = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;

		let user: User;
		if (cookieContents) {
			// If logged in, return user
			try {
				user = await resolveJwt(cookieContents);
				return sanitizeUser(user);
			} catch (error) {
				res.clearCookie(AUTH_COOKIE_NAME);
			}
		}

		if (this.config.get('userManagement.isInstanceOwnerSetUp')) {
			throw new AuthError('Not logged in');
		}

		try {
			user = await this.userRepository.findOneOrFail({ relations: ['globalRole'] });
		} catch (error) {
			throw new InternalServerError(
				'No users found in database - did you wipe the users table? Create at least one user.',
			);
		}

		if (user.email || user.password) {
			throw new InternalServerError('Invalid database state - user has password set.');
		}

		await issueCookie(res, user);

		return sanitizeUser(user);
	}

	/**
	 * Validate invite token to enable invitee to set up their account.
	 * Authless endpoint.
	 */
	@Get('/resolve-signup-token')
	async resolveSignupToken(req: UserRequest.ResolveSignUp) {
		const { inviterId, inviteeId } = req.query;

		if (!inviterId || !inviteeId) {
			this.logger.debug(
				'Request to resolve signup token failed because of missing user IDs in query string',
				{ inviterId, inviteeId },
			);
			throw new BadRequestError('Invalid payload');
		}

		// Postgres validates UUID format
		for (const userId of [inviterId, inviteeId]) {
			if (!validator.isUUID(userId)) {
				this.logger.debug('Request to resolve signup token failed because of invalid user ID', {
					userId,
				});
				throw new BadRequestError('Invalid userId');
			}
		}

		const users = await this.userRepository.find({ where: { id: In([inviterId, inviteeId]) } });
		if (users.length !== 2) {
			this.logger.debug(
				'Request to resolve signup token failed because the ID of the inviter and/or the ID of the invitee were not found in database',
				{ inviterId, inviteeId },
			);
			throw new BadRequestError('Invalid invite URL');
		}

		const invitee = users.find((user) => user.id === inviteeId);
		if (!invitee || invitee.password) {
			this.logger.error('Invalid invite URL - invitee already setup', {
				inviterId,
				inviteeId,
			});
			throw new BadRequestError('The invitation was likely either deleted or already claimed');
		}

		const inviter = users.find((user) => user.id === inviterId);
		if (!inviter?.email || !inviter?.firstName) {
			this.logger.error(
				'Request to resolve signup token failed because inviter does not exist or is not set up',
				{
					inviterId: inviter?.id,
				},
			);
			throw new BadRequestError('Invalid request');
		}

		void this.internalHooks.onUserInviteEmailClick({ inviter, invitee });

		const { firstName, lastName } = inviter;
		return { inviter: { firstName, lastName } };
	}

	/**
	 * Log out a user.
	 * Authless endpoint.
	 */
	@Post('/logout')
	logout(req: Request, res: Response) {
		res.clearCookie(AUTH_COOKIE_NAME);
		return { loggedOut: true };
	}
}
