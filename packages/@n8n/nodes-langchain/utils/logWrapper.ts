import { IExecuteFunctions } from 'n8n-workflow';

import { Tool } from 'langchain/tools';
import { BaseMessage, ChatResult, InputValues } from 'langchain/schema';
import { BaseChatModel } from 'langchain/chat_models/base';
import { CallbackManagerForLLMRun } from 'langchain/callbacks';
import { BaseChatMemory } from 'langchain/memory';

import { Embeddings } from 'langchain/embeddings';
import { MemoryVariables, OutputValues } from 'langchain/dist/memory/base';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';
import { TextSplitter } from 'langchain/text_splitter';
import { BaseDocumentLoader } from 'langchain/document_loaders/base';
import { CallbackManagerForRetrieverRun } from 'langchain/dist/callbacks/manager';
import { BaseLLM } from 'langchain/llms/base';

export function logWrapper(
	originalInstance: Tool | BaseChatMemory | BaseChatModel | BaseLLM | Embeddings | Document[] | Document | BaseDocumentLoader | VectorStoreRetriever | TextSplitter,
	executeFunctions: IExecuteFunctions,
) {
	return new Proxy(originalInstance, {
		get: (target, prop) => {
			// TextSplitter
			if (prop === 'splitText') {
				return async (text: string): Promise<string[]> => {
					executeFunctions.addInputData('textSplitter', [[{ json: { textSplitter: text } }]]);
					// @ts-ignore
					const response = await target[prop](text);
					executeFunctions.addOutputData('textSplitter', [[{ json: { response } }]]);
					return response;
				};
			}
			// Docs -> Embeddings
			if (prop === 'embedDocuments') {
				return async (documents: string[]): Promise<number[][]> => {
					executeFunctions.addInputData('embedding', [[{ json: { documents: documents } }]]);
					// @ts-ignore
					const response = await target[prop](documents);
					executeFunctions.addOutputData('embedding', [[{ json: { response } }]]);
					return response;
				};

			}
			// For BaseRetriever
			if (prop === '_getRelevantDocuments') {
				return async (
					query: string,
					runManager?: CallbackManagerForRetrieverRun
				): Promise<Document[]> => {
					executeFunctions.addInputData('vectorRetriever', [[{ json: { query } }]]);
					// @ts-ignore
					const response = (await target[prop](query, runManager)) as Document[];
					executeFunctions.addOutputData('vectorRetriever', [[{ json: { response } }]]);
					return response;
				};
			}
			if (prop === '_call') {
				return async (query: string): Promise<string> => {
					executeFunctions.addInputData('tool', [[{ json: { query } }]]);
					// @ts-ignore
					const response = await target[prop](query);
					executeFunctions.addOutputData('tool', [[{ json: { response } }]]);
					return response;
				};

				// For BaseChatMemory
			} else if (prop === 'loadMemoryVariables') {
				return async (values: InputValues): Promise<MemoryVariables> => {
					console.log('loadMemoryVariables....1');
					executeFunctions.addInputData('memory', [
						[{ json: { action: 'loadMemoryVariables', values } }],
					]);
					// @ts-ignore
					const response = await target[prop](values);
					executeFunctions.addOutputData('memory', [
						[{ json: { action: 'loadMemoryVariables', response } }],
					]);
					return response;
				};
			} else if (prop === 'saveContext') {
				return async (inputValues: InputValues, outputValues: OutputValues): Promise<void> => {
					executeFunctions.addInputData('memory', [
						[{ json: { action: 'saveContext', inputValues, outputValues } }],
					]);
					// @ts-ignore
					await target[prop](inputValues, outputValues);
					executeFunctions.addOutputData('memory', [[{ json: { action: 'saveContext' } }]]);
				};

				// For BaseChatModel
			} else if (prop === '_generate') {
				return async (
					messages: BaseMessage[],
					options: any,
					runManager?: CallbackManagerForLLMRun,
				): Promise<ChatResult> => {
					executeFunctions.addInputData('languageModel', [[{ json: { messages, options } }]]);
					// @ts-ignore
					const response = (await target[prop](messages, options, runManager)) as ChatResult;
					executeFunctions.addOutputData('languageModel', [[{ json: { response } }]]);
					return response;
				};
			}
			else {
				// @ts-ignore
				return target[prop];
			}
		},
	});
}
