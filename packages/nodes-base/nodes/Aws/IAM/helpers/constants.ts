export const CURRENT_VERSION = '2010-05-08';
export const BASE_URL = 'https://iam.amazonaws.com';
export const ERROR_DESCRIPTIONS = {
	EntityAlreadyExists: {
		User: 'Users must have unique names. Enter a different name for the new user.',
		Group: 'Groups must have unique names. Enter a different name for the new group.',
	},
	NoSuchEntity: {
		User: 'The given user was not found - try entering a different user.',
		Group: 'The given group was not found - try entering a different group.',
	},
	DeleteConflict: {
		Default: 'Cannot delete entity, please remove users from group first.',
	},
};
