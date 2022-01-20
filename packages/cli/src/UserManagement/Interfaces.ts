/* eslint-disable import/no-cycle */
import { Application } from 'express';
import express = require('express');
import { JwtFromRequestFunction } from 'passport-jwt';
import { Interface } from 'readline';
import { User } from '../databases/entities/User';

export interface JwtToken {
	token: string;
	expiresIn: number;
}

export interface JwtOptions {
	secretOrKey: string;
	jwtFromRequest: JwtFromRequestFunction;
}

export interface JwtPayload {
	id: string;
	email: string | null;
	password: string | null;
}

export interface PublicUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	personalizationAnswers?: { [key: string]: string } | null;
	password?: string;
	passwordResetToken?: string;
}

export interface N8nApp {
	app: Application;
	restEndpoint: string;
}

export type AuthenticatedRequest<ReqBody = {}, ReqQuery = {}, ReqParams = {}> = express.Request<
	ReqParams,
	{},
	ReqBody,
	ReqQuery
> & { user: User };

// ----------------------------------
//         requests to /me
// ----------------------------------

declare namespace UpdateSelfPayload {
	type Settings = Pick<PublicUser, 'email' | 'firstName' | 'lastName'>;
	type Password = Pick<PublicUser, 'password'>;
	type SurveyAnswers = { [key: string]: string } | {};
}

export declare namespace UpdateSelfRequest {
	export type Settings = AuthenticatedRequest<UpdateSelfPayload.Settings>;
	export type Password = AuthenticatedRequest<UpdateSelfPayload.Password>;
	export type SurveyAnswers = AuthenticatedRequest<UpdateSelfPayload.SurveyAnswers>;
}

// ----------------------------------
//      password reset requests
// ----------------------------------

declare namespace PasswordResetPayload {
	type Email = Pick<PublicUser, 'email'>;
	type NewPassword = Pick<PublicUser, 'password'> & { token?: string; id?: string };
}

declare namespace PasswordResetQuery {
	type Credentials = { userId?: string; token?: string };
}

export declare namespace PasswordResetRequest {
	export type Email = AuthenticatedRequest<PasswordResetPayload.Email>;
	export type Credentials = AuthenticatedRequest<{}, PasswordResetQuery.Credentials>;
	export type NewPassword = AuthenticatedRequest<PasswordResetPayload.NewPassword>;
}

// ----------------------------------
//      users requests
// ----------------------------------

declare namespace UserPayload {
	type Invitations = Array<{ email: string }>;
}

declare namespace UserQuery {
	type Signup = { inviterId?: string; inviteeId?: string };
	type Deletion = { transferId?: string };
}

export declare namespace UserRequest {
	export type Invites = AuthenticatedRequest<UserPayload.Invitations>;
	export type Signup = AuthenticatedRequest<{}, UserQuery.Signup>;
	export type Deletion = AuthenticatedRequest<{}, UserQuery.Deletion, { id: string }>;
	export type Reinvite = AuthenticatedRequest<{}, {}, { id: string }>;
}
