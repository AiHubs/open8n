/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import { IExecuteFunctions } from 'n8n-core';

import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from 'n8n-workflow';

import { reportUAFields, reportUAOperations } from './ReportUADescription';

import { userActivityFields, userActivityOperations } from './UserActivityDescription';

import {
	getDimensions,
	getDimensionsGA4,
	getMetrics,
	getMetricsGA4,
	getProperties,
	getViews,
	googleApiRequest,
	googleApiRequestAllItems,
	merge,
	prepareDateRange,
	processFilters,
	simplify,
	simplifyGA4,
} from '../GenericFunctions';


import { IData, IDimension, IMetric } from '../Interfaces';
import { reportGA4Fields, reportGA4Operations } from './ReportGA4Description';

const versionDescription: INodeTypeDescription = {
	displayName: 'Google Analytics',
	name: 'googleAnalytics',
	icon: 'file:analytics.svg',
	group: ['transform'],
	version: 2,
	subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
	description: 'Use the Google Analytics API',
	defaults: {
		name: 'Google Analytics',
	},
	inputs: ['main'],
	outputs: ['main'],
	credentials: [
		{
			name: 'googleAnalyticsOAuth2',
			required: true,
		},
	],
	properties: [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'Report for Google Analytics 4',
					value: 'reportGA4',
				},
				{
					name: 'Report for Universal Analytic',
					value: 'report',
				},
				{
					name: 'User Activity',
					value: 'userActivity',
				},
			],
			default: 'report',
		},
		//-------------------------------
		// Reports Google Analytics 4
		//-------------------------------
		...reportGA4Operations,
		...reportGA4Fields,

		//-------------------------------
		// Reports Uinversal Analytic
		//-------------------------------
		...reportUAOperations,
		...reportUAFields,

		//-------------------------------
		// User Activity Operations
		//-------------------------------
		...userActivityOperations,
		...userActivityFields,
	],
};

export class GoogleAnalyticsV2 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			...versionDescription,
		};
	}

	methods = {
		loadOptions: {
			getViews,
			getDimensions,
			getMetrics,
			getProperties,
			getDimensionsGA4,
			getMetricsGA4,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let responseData;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'report') {
					if (operation === 'get') {
						//https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet
						const viewId = this.getNodeParameter('viewId', i) as string;
						const returnAll = this.getNodeParameter('returnAll', 0) as boolean;
						const dateRange = this.getNodeParameter('dateRange', i) as string;
						const metricsUA = this.getNodeParameter('metricsUA', i) as IDataObject;
						const dimensionsUA = this.getNodeParameter('dimensionsUA', i) as IDataObject;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const simple = this.getNodeParameter('simple', i) as boolean;

						const qs: IDataObject = {};
						const body: IData = {
							viewId,
							dateRanges: prepareDateRange.call(this, dateRange, i),
						};

						if (metricsUA.metricValues) {
							const metrics = (metricsUA.metricValues as IDataObject[]).map((metric) => {
								if (metric.listName !== 'more') {
									return { expression: metric.listName };
								} else {
									const newMetric = {
										alias: metric.name,
										expression: metric.expression || metric.name,
										formattingType: metric.formattingType,
									};

									return newMetric;
								}
							});
							if (metrics.length) {
								body.metrics = metrics as IMetric[];
							}
						}

						if (dimensionsUA.dimensionValues) {
							const dimensions = (dimensionsUA.dimensionValues as IDataObject[]).map(
								(dimension) => {
									if (dimension.listName !== 'more') {
										return { name: dimension.listName };
									} else {
										const newDimension = {
											name: dimension.name,
										};

										return newDimension;
									}
								},
							);
							if (dimensions.length) {
								body.dimensions = dimensions as IDimension[];
							}
						}

						if (additionalFields.useResourceQuotas) {
							qs.useResourceQuotas = additionalFields.useResourceQuotas;
						}

						if (additionalFields.dimensionFiltersUi) {
							const dimensionFilters = (additionalFields.dimensionFiltersUi as IDataObject)
								.filterValues as IDataObject[];
							if (dimensionFilters) {
								dimensionFilters.forEach((filter) => (filter.expressions = [filter.expressions]));
								body.dimensionFilterClauses = { filters: dimensionFilters };
							}
						}

						if (additionalFields.includeEmptyRows) {
							Object.assign(body, { includeEmptyRows: additionalFields.includeEmptyRows });
						}
						if (additionalFields.hideTotals) {
							Object.assign(body, { hideTotals: additionalFields.hideTotals });
						}
						if (additionalFields.hideValueRanges) {
							Object.assign(body, { hideTotals: additionalFields.hideTotals });
						}

						const method = 'POST';
						const endpoint = '/v4/reports:batchGet';

						if (returnAll === true) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'reports',
								method,
								endpoint,
								{ reportRequests: [body] },
								qs,
							);
						} else {
							responseData = await googleApiRequest.call(
								this,
								method,
								endpoint,
								{ reportRequests: [body] },
								qs,
							);
							responseData = responseData.reports;
						}

						if (simple === true) {
							responseData = simplify(responseData);
						} else if (returnAll === true && responseData.length > 1) {
							responseData = merge(responseData);
						}
					}
				}

				if (resource === 'reportGA4') {
					if (operation === 'get') {
						//migration guide: https://developers.google.com/analytics/devguides/migration/api/reporting-ua-to-ga4#core_reporting
						const propertyId = this.getNodeParameter('propertyId', i) as string;
						const returnAll = this.getNodeParameter('returnAll', 0) as boolean;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const dateRange = this.getNodeParameter('dateRange', i) as string;
						const metricsGA4 = this.getNodeParameter('metricsGA4', i, {}) as IDataObject;
						const dimensionsGA4 = this.getNodeParameter('dimensionsGA4', i, {}) as IDataObject;
						const simple = this.getNodeParameter('simple', i) as boolean;

						const qs: IDataObject = {};
						const body: IDataObject = {
							dateRanges: prepareDateRange.call(this, dateRange, i),
						};

						if (metricsGA4.metricValues) {
							const metrics = (metricsGA4.metricValues as IDataObject[]).map((metric) => {
								if (metric.listName !== 'more') {
									return { name: metric.listName };
								} else {
									const newMetric = {
										name: metric.name,
										expression: metric.expression,
										invisible: metric.invisible,
									};

									if (newMetric.invisible === false) {
										delete newMetric.invisible;
									}

									if (newMetric.expression === '') {
										delete newMetric.expression;
									}

									return newMetric;
								}
							});
							if (metrics.length) {
								body.metrics = metrics;
							}
						}

						if (dimensionsGA4.dimensionValues) {
							const dimensions = (dimensionsGA4.dimensionValues as IDataObject[]).map(
								(dimension) => {
									if (dimension.listName !== 'more') {
										return { name: dimension.listName };
									} else {
										const newDimension = {
											name: dimension.name,
										};

										return newDimension;
									}
								},
							);
							if (dimensions.length) {
								body.dimensions = dimensions;
							}
						}

						if (additionalFields.currencyCode) {
							body.currencyCode = additionalFields.currencyCode;
						}

						if (additionalFields.dimensionFiltersUI) {
							const { filterExpressionType, expression } = (
								additionalFields.dimensionFiltersUI as IDataObject
							).filterExpressions as IDataObject;
							if (expression) {
								body.dimensionFilter = {
									[filterExpressionType as string]: {
										expressions: processFilters(expression as IDataObject),
									},
								};
							}
						}

						if (additionalFields.metricsFiltersUI) {
							const { filterExpressionType, expression } = (
								additionalFields.metricsFiltersUI as IDataObject
							).filterExpressions as IDataObject;
							if (expression) {
								body.metricFilter = {
									[filterExpressionType as string]: {
										expressions: processFilters(expression as IDataObject),
									},
								};
							}
						}

						if (additionalFields.metricAggregations) {
							body.metricAggregations = additionalFields.metricAggregations;
						}

						if (additionalFields.keepEmptyRows) {
							body.keepEmptyRows = additionalFields.keepEmptyRows;
						}

						if (additionalFields.orderByUI) {
							let orderBys: IDataObject[] = [];
							const metricOrderBy = (additionalFields.orderByUI as IDataObject)
								.metricOrderBy as IDataObject[];
							const dimmensionOrderBy = (additionalFields.orderByUI as IDataObject)
								.dimmensionOrderBy as IDataObject[];
							if (metricOrderBy) {
								orderBys = orderBys.concat(
									metricOrderBy.map((order) => {
										return {
											desc: order.desc,
											metric: {
												metricName: order.metricName,
											},
										};
									}),
								);
							}
							if (dimmensionOrderBy) {
								orderBys = orderBys.concat(
									dimmensionOrderBy.map((order) => {
										return {
											desc: order.desc,
											dimension: {
												dimensionName: order.dimensionName,
												orderType: order.orderType,
											},
										};
									}),
								);
							}
							body.orderBys = orderBys;
						}

						if (additionalFields.returnPropertyQuota) {
							body.returnPropertyQuota = additionalFields.returnPropertyQuota;
						}

						const method = 'POST';
						const endpoint = `/v1beta/${propertyId}:runReport`;

						if (returnAll === true) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'',
								method,
								endpoint,
								body,
								qs,
							);
						} else {
							body.limit = this.getNodeParameter('limit', 0) as number;
							responseData = [await googleApiRequest.call(this, method, endpoint, body, qs)];
						}

						if (responseData && responseData.length && simple === true) {
							responseData = simplifyGA4(responseData[0]);
						}
					}
				}

				if (resource === 'userActivity') {
					if (operation === 'search') {
						//https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/userActivity/search
						const viewId = this.getNodeParameter('viewId', i);
						const userId = this.getNodeParameter('userId', i);
						const returnAll = this.getNodeParameter('returnAll', 0) as boolean;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const body: IDataObject = {
							viewId,
							user: {
								userId,
							},
						};

						if (additionalFields.activityTypes) {
							Object.assign(body, { activityTypes: additionalFields.activityTypes });
						}

						const method = 'POST';
						const endpoint = '/v4/userActivity:search';

						if (returnAll) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'sessions',
								method,
								endpoint,
								body,
							);
						} else {
							body.pageSize = this.getNodeParameter('limit', 0) as number;
							responseData = await googleApiRequest.call(this, method, endpoint, body);
							responseData = responseData.sessions;
						}
					}
				}

				if (Array.isArray(responseData)) {
					returnData.push.apply(returnData, responseData as IDataObject[]);
				} else if (responseData !== undefined) {
					returnData.push(responseData as IDataObject);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw error;
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
