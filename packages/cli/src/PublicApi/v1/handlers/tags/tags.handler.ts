import type express from 'express';

import {
	getTags,
	getTagsCount,
	createTag,
	updateTag,
	deleteTag,
	getTagById,
} from './tags.service';
import config from '@/config';
import { TagEntity } from '@db/entities/TagEntity';
import { authorize, validCursor } from '../../shared/middlewares/global.middleware';
import type { TagRequest } from '../../../types';
import { encodeNextCursor } from '../../shared/services/pagination.service';
import { ExternalHooks } from '@/ExternalHooks';
import { validateEntity } from '@/GenericHelpers';

import { Container } from 'typedi';
import type { FindManyOptions, FindOptionsWhere } from 'typeorm';

export = {
	createTag: [
		authorize(['owner', 'member']),
		async (req: TagRequest.Create, res: express.Response): Promise<express.Response> => {
			const { name } = req.body;

			const newTag = new TagEntity();
			newTag.name = name.trim();

			await Container.get(ExternalHooks).run('tag.beforeCreate', [newTag]);

			await validateEntity(newTag);

			const where: FindOptionsWhere<TagEntity> = {
				...(newTag.name !== undefined && { name: newTag.name })
			};
			const query: FindManyOptions<TagEntity> = {
				where,
			};

			let tags = await getTags(query);
			if (tags.length > 0) {
				return res.status(409).json({ message: 'Tag already exists' });
			}
			let createdTag = await createTag(newTag);
			
			await Container.get(ExternalHooks).run('tag.afterCreate', [createdTag]);

			return res.status(201).json(createdTag);
		},
	],
	updateTag: [
		authorize(['owner', 'member']),
		async (req: TagRequest.Update, res: express.Response): Promise<express.Response> => {
			const { id } = req.params;
			const { name } = req.body;

			let tag = await getTagById(id);

			if (tag === null) {
				return res.status(404).json({ message: 'Not Found' });
			}

			const newTag = new TagEntity();
			newTag.id = id;
			newTag.name = name.trim();

			await Container.get(ExternalHooks).run('tag.beforeUpdate', [newTag]);

			await validateEntity(newTag);

			const where: FindOptionsWhere<TagEntity> = {
				...(newTag.name !== undefined && { name: newTag.name })
			};
			const query: FindManyOptions<TagEntity> = {
				where,
			};

			let tags = await getTags(query);
			if (tags.length > 0) {
				return res.status(409).json({ message: 'Tag already exists' });
			}
			await updateTag(id, newTag);

			await Container.get(ExternalHooks).run('tag.afterUpdate', [tag]);

			tag = await getTagById(id);

			return res.json(tag);
		},
	],
	deleteTag: [
		authorize(['owner', 'member']),
		async (req: TagRequest.Delete, res: express.Response): Promise<express.Response> => {
			if (
				config.getEnv('userManagement.isInstanceOwnerSetUp') === true &&
				req.user.globalRole.name !== 'owner'
			) {
				return res.status(403).json({ message: 'You are not allowed to perform this action. Only owners can remove tags' });
			}
			
			const { id } = req.params;

			let tag = await getTagById(id);

			if (tag === null) {
				return res.status(404).json({ message: 'Not Found' });
			}

			await Container.get(ExternalHooks).run('tag.beforeDelete', [id]);

			await deleteTag(id);

			await Container.get(ExternalHooks).run('tag.afterUpdate', [id]);

			return res.json(tag);
		},
	],
	getTags: [
		authorize(['owner', 'member']),
		validCursor,
		async (req: TagRequest.GetAll, res: express.Response): Promise<express.Response> => {
			const {
				offset = 0,
				limit = 100,
			} = req.query;

			let tags: TagEntity[];
			let count: number;

			const query: FindManyOptions<TagEntity> = {
				skip: offset,
				take: limit,
			};

			tags = await getTags(query);
			count = await getTagsCount(query);

			return res.json({
				data: tags,
				nextCursor: encodeNextCursor({
					offset,
					limit,
					numberOfTotalRecords: count,
				}),
			});
		},
	],
	getTag: [
		authorize(['owner', 'member']),
		async (req: TagRequest.Get, res: express.Response): Promise<express.Response> => {
			const { id } = req.params;

			let tag = await getTagById(id);

			if (tag === null) {
				return res.status(404).json({ message: 'Not Found' });
			}

			return res.json(tag);
		},
	],
};
