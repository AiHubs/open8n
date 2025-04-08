export type IGroup = {
	Arn: string;
	CreateDate: number;
	GroupId: string;
	GroupName: string;
	Path?: string;
};

export type IUser = {
	Arn: string;
	CreateDate: number;
	PasswordLastUsed?: number;
	Path?: string;
	PermissionsBoundary?: string;
	Tags: Array<{ Key: string; Value: string }>;
	UserId: string;
	UserName: string;
};

export type IGetUserResponseBody = {
	GetUserResponse: {
		GetUserResult: {
			User: IUser;
		};
	};
};

export type IGetGroupResponseBody = {
	GetGroupResponse: {
		GetGroupResult: {
			Group: IGroup;
			Users?: IUser[];
		};
	};
};

export type IGetAllUsersResponseBody = {
	ListUsersResponse: {
		ListUsersResult: {
			Users: IUser[];
			IsTruncated: boolean;
			Marker: string;
		};
	};
};

export type IGetAllGroupsResponseBody = {
	ListGroupsResponse: {
		ListGroupsResult: {
			Groups: IGroup[];
			IsTruncated: boolean;
			Marker: string;
		};
	};
};

export type ITags = {
	tags: Array<{ key: string; value: string }>;
};
