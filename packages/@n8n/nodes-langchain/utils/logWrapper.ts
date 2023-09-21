import {
	NodeOperationError,
	type ConnectionTypes,
	type IExecuteFunctions,
	type INodeExecutionData,
} from 'n8n-workflow';

import { Tool } from 'langchain/tools';
import type { BaseMessage, ChatResult, InputValues } from 'langchain/schema';
import { BaseChatMessageHistory } from 'langchain/schema';
import { BaseChatModel } from 'langchain/chat_models/base';
import type { CallbackManagerForLLMRun } from 'langchain/callbacks';

import { Embeddings } from 'langchain/embeddings/base';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { VectorStore } from 'langchain/vectorstores/base';
import type { Document } from 'langchain/document';
import { TextSplitter } from 'langchain/text_splitter';
import type { BaseDocumentLoader } from 'langchain/document_loaders/base';
import type { CallbackManagerForRetrieverRun, Callbacks } from 'langchain/dist/callbacks/manager';
import { BaseLLM } from 'langchain/llms/base';
import { BaseChatMemory } from 'langchain/memory';
import type { MemoryVariables } from 'langchain/dist/memory/base';
import { BaseRetriever } from 'langchain/schema/retriever';
import type { FormatInstructionsOptions } from 'langchain/schema/output_parser';
import { BaseOutputParser } from 'langchain/schema/output_parser';
import { N8nJsonLoader } from './N8nJsonLoader';
import { N8nBinaryLoader } from './N8nBinaryLoader';

export async function callMethodAsync<T>(
	this: T,
	parameters: {
		executeFunctions: IExecuteFunctions;
		connectionType: ConnectionTypes;
		method: (...args: any[]) => Promise<unknown>;
		arguments: unknown[];
	},
): Promise<unknown> {
	try {
		return await parameters.method.call(this, ...parameters.arguments);
	} catch (e) {
		const connectedNode = parameters.executeFunctions.getNode();
		const error = new NodeOperationError(connectedNode, e);
		parameters.executeFunctions.addOutputData(parameters.connectionType, error);
		throw new NodeOperationError(
			connectedNode,
			`Error on node "${connectedNode.name}" which is connected via input "${parameters.connectionType}"`,
		);
	}
}

export function callMethodSync<T>(
	this: T,
	parameters: {
		executeFunctions: IExecuteFunctions;
		connectionType: ConnectionTypes;
		method: (...args: any[]) => T;
		arguments: unknown[];
	},
): unknown {
	try {
		return parameters.method.call(this, ...parameters.arguments);
	} catch (e) {
		const connectedNode = parameters.executeFunctions.getNode();
		const error = new NodeOperationError(connectedNode, e);
		parameters.executeFunctions.addOutputData(parameters.connectionType, error);
		throw new NodeOperationError(
			connectedNode,
			`Error on node "${connectedNode.name}" which is connected via input "${parameters.connectionType}"`,
		);
	}
}

export function logWrapper(
	originalInstance:
		| Tool
		| BaseChatModel
		| BaseChatMemory
		| BaseLLM
		| BaseChatMessageHistory
		| BaseOutputParser
		| Embeddings
		| Document[]
		| Document
		| BaseDocumentLoader
		| VectorStoreRetriever
		| TextSplitter
		| VectorStore
		| N8nBinaryLoader
		| N8nJsonLoader,
	executeFunctions: IExecuteFunctions,
) {
	return new Proxy(originalInstance, {
		get: (target, prop) => {
			let connectionType: ConnectionTypes | undefined;
			// ========== BaseChatMemory ==========
			if (originalInstance instanceof BaseChatMemory) {
				if (prop === 'loadMemoryVariables' && 'loadMemoryVariables' in target) {
					return async (values: InputValues): Promise<MemoryVariables> => {
						connectionType = 'memory';
						executeFunctions.addInputData(connectionType, [
							[{ json: { action: 'loadMemoryVariables', values } }],
						]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [values],
						})) as MemoryVariables;

						executeFunctions.addOutputData(connectionType, [
							[{ json: { action: 'loadMemoryVariables', response } }],
						]);
						return response;
					};
				} else if (
					prop === 'outputKey' &&
					'outputKey' in target &&
					target.constructor.name === 'BufferWindowMemory'
				) {
					connectionType = 'memory';
					executeFunctions.addInputData(connectionType, [[{ json: { action: 'chatHistory' } }]]);
					const response = target[prop];

					target.chatHistory
						.getMessages()
						.then((messages) => {
							executeFunctions.addOutputData('memory', [
								[{ json: { action: 'chatHistory', chatHistory: messages } }],
							]);
						})
						.catch((error: Error) => {
							executeFunctions.addOutputData('memory', [
								[{ json: { action: 'chatHistory', error } }],
							]);
						});
					return response;
				}
			}

			// ========== BaseChatMessageHistory ==========
			if (originalInstance instanceof BaseChatMessageHistory) {
				if (prop === 'getMessages' && 'getMessages' in target) {
					return async (): Promise<BaseMessage[]> => {
						connectionType = 'memory';
						executeFunctions.addInputData(connectionType, [[{ json: { action: 'getMessages' } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [],
						})) as BaseMessage[];

						executeFunctions.addOutputData(connectionType, [
							[{ json: { action: 'getMessages', response } }],
						]);
						return response;
					};
				} else if (prop === 'addMessage' && 'addMessage' in target) {
					return async (message: BaseMessage): Promise<void> => {
						connectionType = 'memory';
						executeFunctions.addInputData(connectionType, [
							[{ json: { action: 'addMessage', message } }],
						]);

						await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [message],
						});

						executeFunctions.addOutputData(connectionType, [[{ json: { action: 'addMessage' } }]]);
					};
				}
			}

			// ========== BaseChatModel ==========
			if (originalInstance instanceof BaseLLM || originalInstance instanceof BaseChatModel) {
				if (prop === '_generate' && '_generate' in target) {
					return async (
						messages: BaseMessage[] & string[],
						options: any,
						runManager?: CallbackManagerForLLMRun,
					): Promise<ChatResult> => {
						connectionType = 'languageModel';
						executeFunctions.addInputData(connectionType, [[{ json: { messages, options } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [messages, options, runManager],
						})) as ChatResult;

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== BaseOutputParser ==========
			if (originalInstance instanceof BaseOutputParser) {
				if (prop === 'getFormatInstructions' && 'getFormatInstructions' in target) {
					return (options?: FormatInstructionsOptions): string => {
						connectionType = 'outputParser';
						executeFunctions.addInputData(connectionType, [
							[{ json: { action: 'getFormatInstructions' } }],
						]);

						// @ts-ignore
						const response = callMethodSync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [options],
						}) as string;

						executeFunctions.addOutputData(connectionType, [
							[{ json: { action: 'getFormatInstructions', response } }],
						]);
						return response;
					};
				} else if (prop === 'parse' && 'parse' in target) {
					return async (text: string): Promise<any> => {
						connectionType = 'outputParser';
						executeFunctions.addInputData(connectionType, [[{ json: { action: 'parse', text } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [text],
						})) as object;

						executeFunctions.addOutputData(connectionType, [
							[{ json: { action: 'parse', response } }],
						]);
						return response;
					};
				}
			}

			// ========== BaseRetriever ==========
			if (originalInstance instanceof BaseRetriever) {
				if (prop === '_getRelevantDocuments' && '_getRelevantDocuments' in target) {
					return async (
						query: string,
						runManager?: CallbackManagerForRetrieverRun,
					): Promise<Document[]> => {
						connectionType = 'vectorRetriever';
						executeFunctions.addInputData(connectionType, [[{ json: { query } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [query, runManager],
						})) as Array<Document<Record<string, any>>>;

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== Embeddings ==========
			if (originalInstance instanceof Embeddings) {
				// Docs -> Embeddings
				if (prop === 'embedDocuments' && 'embedDocuments' in target) {
					return async (documents: string[]): Promise<number[][]> => {
						connectionType = 'embedding';
						executeFunctions.addInputData(connectionType, [[{ json: { documents } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [documents],
						})) as number[][];

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
				// Query -> Embeddings
				if (prop === 'embedQuery' && 'embedQuery' in target) {
					return async (query: string): Promise<number[]> => {
						connectionType = 'embedding';
						executeFunctions.addInputData(connectionType, [[{ json: { query } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [query],
						})) as number[];

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== N8nJsonLoader ==========
			if (
				originalInstance instanceof N8nJsonLoader ||
				originalInstance instanceof N8nBinaryLoader
			) {
				// JSON Input -> Documents
				if (prop === 'process' && 'process' in target) {
					return async (items: INodeExecutionData[]): Promise<number[]> => {
						connectionType = 'document';
						executeFunctions.addInputData(connectionType, [items]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [items],
						})) as number[];

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== TextSplitter ==========
			if (originalInstance instanceof TextSplitter) {
				if (prop === 'splitText' && 'splitText' in target) {
					return async (text: string): Promise<string[]> => {
						connectionType = 'textSplitter';
						executeFunctions.addInputData(connectionType, [[{ json: { textSplitter: text } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [text],
						})) as string[];

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== Tool ==========
			if (originalInstance instanceof Tool) {
				if (prop === '_call' && '_call' in target) {
					return async (query: string): Promise<string> => {
						connectionType = 'tool';
						executeFunctions.addInputData(connectionType, [[{ json: { query } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [query],
						})) as string;

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== VectorStore ==========
			if (originalInstance instanceof VectorStore) {
				if (prop === 'similaritySearch' && 'similaritySearch' in target) {
					return async (
						query: string,
						k?: number,
						// @ts-ignore
						filter?: BiquadFilterType | undefined,
						_callbacks?: Callbacks | undefined,
					): Promise<Document[]> => {
						connectionType = 'vectorStore';
						executeFunctions.addInputData(connectionType, [[{ json: { query, k, filter } }]]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							method: target[prop],
							arguments: [query, k, filter, _callbacks],
						})) as Array<Document<Record<string, any>>>;

						executeFunctions.addOutputData(connectionType, [[{ json: { response } }]]);

						return response;
					};
				}
			}

			return (target as any)[prop];
		},
	});
}
