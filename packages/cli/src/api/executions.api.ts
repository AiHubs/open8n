/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import express from 'express';
import _, { cloneDeep } from 'lodash';
import {
	IDataObject,
	INodeCredentialsDetails,
	INodeCredentialTestResult,
	LoggerProxy,
	WorkflowExecuteMode,
} from 'n8n-workflow';
import {
	FindManyOptions,
	getConnectionManager,
	In,
	IsNull,
	LessThanOrEqual,
	Not,
	Raw,
} from 'typeorm';

import {
	ActiveExecutions,
	DatabaseType,
	Db,
	GenericHelpers,
	IExecutionFlattedDb,
	IExecutionFlattedResponse,
	IExecutionPushResponse,
	IExecutionResponse,
	IExecutionsListResponse,
	IExecutionsStopData,
	IExecutionsSummary,
	whereClause,
	ResponseHelper,
	CredentialTypes,
} from '..';
import * as config from '../../config';
import { ExecutionEntity } from '../databases/entities/ExecutionEntity';
import { User } from '../databases/entities/User';
import { DEFAULT_EXECUTIONS_GET_ALL_LIMIT, validateEntity } from '../GenericHelpers';
import { getLogger } from '../Logger';
import * as Queue from '../Queue';
import type { ExecutionRequest } from '../requests';
import { getSharedWorkflowIds, isBelowOnboardingThreshold } from '../WorkflowHelpers';

export const executionsController = express.Router();

/**
 * Initialise Logger if needed
 */
executionsController.use((req, res, next) => {
	try {
		LoggerProxy.getInstance();
	} catch (error) {
		LoggerProxy.init(getLogger());
	}
	next();
});

/**
 * Helper function to retrieve count of Executions
 */
async function getExecutionsCount(
	countFilter: IDataObject,
	user: User,
): Promise<{ count: number; estimated: boolean }> {
	const dbType = (await GenericHelpers.getConfigValue('database.type')) as DatabaseType;
	const filteredFields = Object.keys(countFilter).filter((field) => field !== 'id');

	// For databases other than Postgres, do a regular count
	// when filtering based on `workflowId` or `finished` fields.
	if (dbType !== 'postgresdb' || filteredFields.length > 0 || user.globalRole.name !== 'owner') {
		const sharedWorkflowIds = await getSharedWorkflowIds(user);

		const count = await Db.collections.Execution.count({
			where: {
				workflowId: In(sharedWorkflowIds),
				...countFilter,
			},
		});

		return { count, estimated: false };
	}

	try {
		// Get an estimate of rows count.
		const estimateRowsNumberSql =
			"SELECT n_live_tup FROM pg_stat_all_tables WHERE relname = 'execution_entity';";
		const rows: Array<{ n_live_tup: string }> = await Db.collections.Execution.query(
			estimateRowsNumberSql,
		);

		const estimate = parseInt(rows[0].n_live_tup, 10);
		// If over 100k, return just an estimate.
		if (estimate > 100_000) {
			// if less than 100k, we get the real count as even a full
			// table scan should not take so long.
			return { count: estimate, estimated: true };
		}
	} catch (error) {
		LoggerProxy.warn(`Failed to get executions count from Postgres: ${error}`);
	}

	const sharedWorkflowIds = await getSharedWorkflowIds(user);

	const count = await Db.collections.Execution.count({
		where: {
			workflowId: In(sharedWorkflowIds),
		},
	});

	return { count, estimated: false };
}

/**
 * GET /executions
 */
executionsController.get(
	'/',
	ResponseHelper.send(async (req: ExecutionRequest.GetAll): Promise<IExecutionsListResponse> => {
		const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

		const limit = req.query.limit
			? parseInt(req.query.limit, 10)
			: DEFAULT_EXECUTIONS_GET_ALL_LIMIT;

		const executingWorkflowIds: string[] = [];

		if (config.getEnv('executions.mode') === 'queue') {
			const currentJobs = await Queue.getInstance().getJobs(['active', 'waiting']);
			executingWorkflowIds.push(...currentJobs.map(({ data }) => data.executionId));
		}

		// We may have manual executions even with queue so we must account for these.
		executingWorkflowIds.push(
			...ActiveExecutions.getInstance()
				.getActiveExecutions()
				.map(({ id }) => id),
		);

		const countFilter = cloneDeep(filter);
		countFilter.waitTill &&= Not(IsNull());
		countFilter.id = Not(In(executingWorkflowIds));

		const sharedWorkflowIds = await getSharedWorkflowIds(req.user);

		const findOptions: FindManyOptions<ExecutionEntity> = {
			select: [
				'id',
				'finished',
				'mode',
				'retryOf',
				'retrySuccessId',
				'waitTill',
				'startedAt',
				'stoppedAt',
				'workflowData',
			],
			where: { workflowId: In(sharedWorkflowIds) },
			order: { id: 'DESC' },
			take: limit,
		};

		Object.entries(filter).forEach(([key, value]) => {
			let filterToAdd = {};

			if (key === 'waitTill') {
				filterToAdd = { waitTill: Not(IsNull()) };
			} else if (key === 'finished' && value === false) {
				filterToAdd = { finished: false, waitTill: IsNull() };
			} else {
				filterToAdd = { [key]: value };
			}

			Object.assign(findOptions.where!, filterToAdd);
		});

		const rangeQuery: string[] = [];
		const rangeQueryParams: {
			lastId?: string;
			firstId?: string;
			executingWorkflowIds?: string[];
		} = {};

		if (req.query.lastId) {
			rangeQuery.push('id < :lastId');
			rangeQueryParams.lastId = req.query.lastId;
		}

		if (req.query.firstId) {
			rangeQuery.push('id > :firstId');
			rangeQueryParams.firstId = req.query.firstId;
		}

		if (executingWorkflowIds.length > 0) {
			rangeQuery.push(`id NOT IN (:...executingWorkflowIds)`);
			rangeQueryParams.executingWorkflowIds = executingWorkflowIds;
		}

		if (rangeQuery.length) {
			Object.assign(findOptions.where!, {
				id: Raw(() => rangeQuery.join(' and '), rangeQueryParams),
			});
		}

		const executions = await Db.collections.Execution.find(findOptions);

		const { count, estimated } = await getExecutionsCount(countFilter, req.user);

		const formattedExecutions = executions.map((execution) => {
			return {
				id: execution.id.toString(),
				finished: execution.finished,
				mode: execution.mode,
				retryOf: execution.retryOf?.toString(),
				retrySuccessId: execution?.retrySuccessId?.toString(),
				waitTill: execution.waitTill as Date | undefined,
				startedAt: execution.startedAt,
				stoppedAt: execution.stoppedAt,
				workflowId: execution.workflowData?.id?.toString() ?? '',
				workflowName: execution.workflowData.name,
			};
		});

		return {
			count,
			results: formattedExecutions,
			estimated,
		};
	}),
);

/**
 * GET /executions/:id
 */
executionsController.get(
	'/:id',
	ResponseHelper.send(
		async (
			req: ExecutionRequest.Get,
		): Promise<IExecutionResponse | IExecutionFlattedResponse | undefined> => {
			const { id: executionId } = req.params;

			const sharedWorkflowIds = await getSharedWorkflowIds(req.user);

			if (!sharedWorkflowIds.length) return undefined;

			const execution = await Db.collections.Execution.findOne({
				where: {
					id: executionId,
					workflowId: In(sharedWorkflowIds),
				},
			});

			if (!execution) {
				LoggerProxy.info('Attempt to read execution was blocked due to insufficient permissions', {
					userId: req.user.id,
					executionId,
				});
				return undefined;
			}

			if (req.query.unflattedResponse === 'true') {
				return ResponseHelper.unflattenExecutionData(execution);
			}

			const { id, ...rest } = execution;

			// @ts-ignore
			return {
				id: id.toString(),
				...rest,
			};
		},
	),
);
