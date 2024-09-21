import ts, { type DiagnosticWithLocation } from 'typescript';
import * as tsvfs from '@typescript/vfs';
import * as Comlink from 'comlink';
import type { LanguageServiceWorker } from '../types';
import { indexedDbCache } from './cache';
import {
	isDiagnosticWithLocation,
	convertTSDiagnosticToCM,
	wrapInFunction,
	FILE_NAME,
	cmPosToTs,
} from './utils';
import type { Completion } from '@codemirror/autocomplete';

const worker = (): LanguageServiceWorker => {
	let env: tsvfs.VirtualTypeScriptEnvironment;

	return {
		async init(content: string) {
			const compilerOptions: ts.CompilerOptions = {
				allowJs: true,
				checkJs: true,
				noLib: true,
			};

			const fsMap = await tsvfs.createDefaultMapFromCDN(
				compilerOptions,
				ts.version,
				true,
				ts,
				undefined,
				undefined,
				await indexedDbCache('typescript-cache', 'fs-map'),
			);

			fsMap.set(FILE_NAME, wrapInFunction(content));
			fsMap.set(
				'types.d.ts',
				`export {};

declare global {
	const $input: { json: Record<string,any>, all: () => [] }
}`,
			);

			const system = tsvfs.createSystem(fsMap);
			env = tsvfs.createVirtualTypeScriptEnvironment(
				system,
				Array.from(fsMap.keys()),
				ts,
				compilerOptions,
			);
		},
		updateFile(content) {
			console.log('update', content);
			const exists = env.getSourceFile(FILE_NAME);
			if (exists) {
				env.updateFile(FILE_NAME, wrapInFunction(content));
			} else {
				env.createFile(FILE_NAME, wrapInFunction(content));
			}
		},
		getCompletionsAtPos(pos) {
			const completionInfo = env.languageService.getCompletionsAtPosition(
				FILE_NAME,
				cmPosToTs(pos),
				{},
				{},
			);

			if (!completionInfo) return null;

			const options = completionInfo.entries.map((entry): Completion => {
				const boost = -Number(entry.sortText) || 0;
				return {
					label: entry.name,
					boost,
				};
			});

			return {
				from: pos,
				options,
			};
		},
		getDiagnostics() {
			const exists = env.getSourceFile(FILE_NAME);
			if (!exists) return [];

			const tsDiagnostics = [
				...env.languageService.getSemanticDiagnostics(FILE_NAME),
				...env.languageService.getSyntacticDiagnostics(FILE_NAME),
			];

			const diagnostics = tsDiagnostics.filter((diagnostic): diagnostic is DiagnosticWithLocation =>
				isDiagnosticWithLocation(diagnostic),
			);

			return diagnostics.map((d) => convertTSDiagnosticToCM(d));
		},
		getHoverTooltip(pos) {
			const quickInfo = env.languageService.getQuickInfoAtPosition(FILE_NAME, cmPosToTs(pos));
			if (!quickInfo) return null;

			const start = quickInfo.textSpan.start;

			const typeDef =
				env.languageService.getTypeDefinitionAtPosition(FILE_NAME, cmPosToTs(pos)) ??
				env.languageService.getDefinitionAtPosition(FILE_NAME, cmPosToTs(pos));

			return {
				start,
				end: start + quickInfo.textSpan.length,
				typeDef,
				quickInfo,
			};
		},
	};
};

Comlink.expose(worker());
