import type { IDataObject } from 'n8n-workflow';

// ToDo: Add IGroup

export type IUser = {
	Arn: string;
	CreateDate: number;
	PasswordLastUsed?: number;
	Path?: string;
	PermissionsBoundary?: string;
	Tags: Array<{ Key: string; Value: string }>; // ToDo: Can this be ITags[]?
	UserId: string;
	UserName: string;
};

export type IGetUserResponseBody = {
	GetUserResponse: {
		GetUserResult: {
			User: IDataObject; // ToDo: Can this be IUser?
		};
	};
};

export type IGetGroupResponseBody = {
	GetGroupResponse: {
		GetGroupResult: {
			Group: IDataObject; // ToDo: Can this be IGroup[]?
			Users?: IDataObject[]; // ToDo: Can this be IUser[]?
		};
	};
};

export type IGetAllUsersResponseBody = {
	ListUsersResponse: {
		ListUsersResult: {
			Users: IDataObject[]; // ToDo: Can this be IUser[]?
			IsTruncated: boolean;
			Marker: string;
		};
	};
};

export type IGetAllGroupsResponseBody = {
	ListGroupsResponse: {
		ListGroupsResult: {
			Groups: IDataObject[]; // ToDo: Can this be IGroup[]?
			IsTruncated: boolean;
			Marker: string;
		};
	};
};

export type ITags = {
	tags: IDataObject[]; // ToDo: Should this be Array<{ Key: string; Value: string }>?
};
