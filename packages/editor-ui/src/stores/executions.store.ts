import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ExecutionStatus, IDataObject, ExecutionSummary } from 'n8n-workflow';
import type {
	ExecutionFilterType,
	ExecutionsQueryFilter,
	IExecutionDeleteFilter,
	IExecutionFlattedResponse,
	IExecutionResponse,
	IExecutionsListResponse,
	IExecutionsStopData,
} from '@/Interface';
import { useRootStore } from '@/stores/n8nRoot.store';
import { makeRestApiRequest, unflattenExecutionData } from '@/utils/apiUtils';
import { isEmpty } from '@/utils/typesUtils';
import { executionFilterToQueryFilter } from '@/utils/executionUtils';

export const useExecutionsStore = defineStore('executions', () => {
	const rootStore = useRootStore();

	const loading = ref(false);
	const itemsPerPage = ref(10);

	const filters = ref<ExecutionFilterType>(getDefaultFilters());
	const executionsFilters = computed<ExecutionsQueryFilter>(() =>
		executionFilterToQueryFilter(filters.value),
	);
	const currentExecutionsFilters = computed<Partial<ExecutionFilterType>>(() => ({
		...(filters.value.workflowId !== 'all' ? { workflowId: filters.value.workflowId } : {}),
	}));

	const autoRefresh = ref(true);
	const autoRefreshTimeout = ref<NodeJS.Timeout | null>(null);
	const autoRefreshDelay = ref(4 * 1000); // Refresh data every 4 secs

	const executionsById = ref<Record<string, ExecutionSummary>>({});
	const executionsCount = ref(0);
	const executionsCountEstimated = ref(false);
	const executions = computed(() => {
		const data = Object.values(executionsById.value);

		data.sort((a, b) => {
			return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
		});

		return data;
	});

	const currentExecutionsById = ref<Record<string, ExecutionSummary>>({});
	const currentExecutions = computed(() => {
		const data = Object.values(currentExecutionsById.value);

		data.sort((a, b) => {
			return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
		});

		return data;
	});

	const filteredExecutions = computed(() => {
		return [...currentExecutions.value, ...executions.value].filter((execution) => {
			let matches = true;

			if (filters.value.workflowId === 'all') {
				matches = matches && true;
			} else {
				matches = matches && execution.workflowId === filters.value.workflowId;
			}

			if (filters.value.status === 'all') {
				matches = matches && true;
			} else {
				matches = matches && filters.value.status.includes(execution.status as string);
			}

			return matches;
		});
	});

	const executionsByWorkflowId = computed(() =>
		executions.value.reduce<Record<string, ExecutionSummary[]>>((acc, execution) => {
			if (!acc[execution.workflowId]) {
				acc[execution.workflowId] = [];
			}
			acc[execution.workflowId].push(execution);
			return acc;
		}, {}),
	);

	function getDefaultFilters(): ExecutionFilterType {
		return {
			workflowId: 'all',
			status: 'all',
			startDate: '',
			endDate: '',
			tags: [],
			metadata: [],
		};
	}

	function addExecution(execution: ExecutionSummary) {
		executionsById.value[execution.id] = {
			...execution,
			status: execution.status ?? getExecutionStatus(execution),
			mode: execution.mode,
		};
	}

	function addRunningExecution(execution: ExecutionSummary) {
		currentExecutionsById.value[execution.id] = {
			...execution,
			status: execution.status ?? getExecutionStatus(execution),
			mode: execution.mode,
		};
	}

	function removeExecution(id: string) {
		const { [id]: _, ...rest } = executionsById.value;
		executionsById.value = rest;
	}

	function setFilters(value: ExecutionFilterType) {
		filters.value = value;
	}

	async function initialize() {
		filters.value = getDefaultFilters();
		setTimeout(async () => {
			await startAutoRefreshInterval();
		}, autoRefreshDelay.value);
	}

	function terminate() {
		stopAutoRefreshInterval();
	}

	function getExecutionStatus(execution: ExecutionSummary): ExecutionStatus {
		if (execution.status) {
			return execution.status;
		} else {
			if (execution.waitTill) {
				return 'waiting';
			} else if (execution.stoppedAt === undefined) {
				return 'running';
			} else if (execution.finished) {
				return 'success';
			} else if (execution.stoppedAt !== null) {
				return 'failed';
			} else {
				return 'unknown';
			}
		}
	}

	async function fetchPastExecutions(
		filter = executionsFilters.value,
		lastId?: string,
		firstId?: string,
	) {
		loading.value = true;
		try {
			const data = await makeRestApiRequest<IExecutionsListResponse>(
				rootStore.getRestApiContext,
				'GET',
				'/executions',
				{
					...(filter ? { filter } : {}),
					...(firstId ? { firstId } : {}),
					...(lastId ? { lastId } : {}),
					limit: itemsPerPage.value,
				},
			);

			data.results.forEach(addExecution);

			executionsCount.value = data.count;
			executionsCountEstimated.value = data.estimated;
		} catch (e) {
			throw e;
		} finally {
			loading.value = false;
		}
	}

	async function fetchCurrentExecutions(filter = currentExecutionsFilters.value) {
		loading.value = true;
		try {
			const data = await makeRestApiRequest<{ results: ExecutionSummary[] }>(
				rootStore.getRestApiContext,
				'GET',
				'/executions',
				{
					...(filter ? { filter } : {}),
				},
			);

			currentExecutionsById.value = {};
			data.results.forEach(addRunningExecution);
		} catch (e) {
			throw e;
		} finally {
			loading.value = false;
		}
	}

	async function fetchExecution(id: string): Promise<IExecutionResponse | undefined> {
		const response = await makeRestApiRequest<IExecutionFlattedResponse>(
			rootStore.getRestApiContext,
			'GET',
			`/executions/${id}`,
		);

		return response ? unflattenExecutionData(response) : undefined;
	}

	async function loadAutoRefresh(): Promise<void> {
		// We cannot use firstId here as some executions finish out of order. Let's say
		// You have execution ids 500 to 505 running.
		// Suppose 504 finishes before 500, 501, 502 and 503.
		// iF you use firstId, filtering id >= 504 you won't
		// ever get ids 500, 501, 502 and 503 when they finish
		const promises = [fetchPastExecutions(executionsFilters.value)];
		if (isEmpty(executionsFilters.value.metadata)) {
			promises.push(fetchCurrentExecutions({}));
		}
		await Promise.all(promises);

		// @TODO
		// this.adjustSelectionAfterMoreItemsLoaded();

		autoRefreshTimeout.value = setTimeout(() => {
			if (autoRefresh.value) {
				void startAutoRefreshInterval();
			}
		}, autoRefreshDelay.value);
	}

	async function startAutoRefreshInterval() {
		autoRefresh.value = true;
		await loadAutoRefresh();
	}

	function stopAutoRefreshInterval() {
		if (autoRefreshTimeout.value) {
			clearTimeout(autoRefreshTimeout.value);
			autoRefreshTimeout.value = null;
		}
	}

	async function stopCurrentExecution(executionId: string): Promise<IExecutionsStopData> {
		return await makeRestApiRequest(
			rootStore.getRestApiContext,
			'POST',
			`/executions/${executionId}/stop`,
		);
	}

	async function retryExecution(id: string, loadWorkflow?: boolean): Promise<boolean> {
		return await makeRestApiRequest(
			rootStore.getRestApiContext,
			'POST',
			`/executions/${id}/retry`,
			loadWorkflow
				? {
						loadWorkflow: true,
				  }
				: undefined,
		);
	}

	async function deleteExecutions(sendData: IExecutionDeleteFilter): Promise<void> {
		await makeRestApiRequest(
			rootStore.getRestApiContext,
			'POST',
			'/executions/delete',
			sendData as unknown as IDataObject,
		);

		if (sendData.ids) {
			sendData.ids.forEach(removeExecution);
		}

		if (sendData.deleteBefore) {
			const deleteBefore = new Date(sendData.deleteBefore);
			filteredExecutions.value.forEach((execution) => {
				if (new Date(execution.startedAt) < deleteBefore) {
					removeExecution(execution.id);
				}
			});
		}
	}

	return {
		loading,
		executionsById,
		executions,
		executionsCount,
		executionsCountEstimated,
		executionsByWorkflowId,
		currentExecutions,
		fetchPastExecutions,
		fetchCurrentExecutions,
		fetchExecution,
		getExecutionStatus,
		autoRefresh,
		autoRefreshTimeout,
		startAutoRefreshInterval,
		stopAutoRefreshInterval,
		initialize,
		terminate,
		filters,
		setFilters,
		executionsFilters,
		currentExecutionsFilters,
		filteredExecutions,
		stopCurrentExecution,
		retryExecution,
		deleteExecutions,
	};
});
