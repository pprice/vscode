/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MergeConflictParser } from './mergeConflictParser';
import * as interfaces from './interfaces';
import { Delayer } from './delayer';

export default class DocumentMergeConflictTracker implements vscode.Disposable, interfaces.IDocumentMergeConflictTracker {

	private cache: Map<string, Delayer<interfaces.IDocumentMergeConflict[]>> = new Map();
	private delayExpireTime: number = 150;

	getConflicts(document: vscode.TextDocument): PromiseLike<interfaces.IDocumentMergeConflict[]> {
		// Attempt from cache

		let key = this.getCacheKey(document);

		if (!key) {
			// Document doesnt have a uri, can't cache it, so return
			return Promise.resolve(this.getConflictsOrEmpty(document));
		}

		let cacheItem = this.cache.get(key);
		if (!cacheItem) {
			cacheItem = new Delayer<interfaces.IDocumentMergeConflict[]>(this.delayExpireTime);
			this.cache.set(key, cacheItem);
		}

		return cacheItem.trigger(() => {
			let conflicts = this.getConflictsOrEmpty(document);

			if (this.cache) {
				this.cache.delete(key!);
			}

			return conflicts;
		});
	}

	forget(document: vscode.TextDocument) {
		let key = this.getCacheKey(document);

		if (key) {
			this.cache.delete(key);
		}
	}

	dispose() {
		this.cache.clear();
	}

	private getConflictsOrEmpty(document: vscode.TextDocument): interfaces.IDocumentMergeConflict[] {
		let stepStart = process.hrtime();
		const containsConflict = MergeConflictParser.containsConflict(document);
		let stepEnd = process.hrtime(stepStart);

		console.info('%s -> Check document execution time: %dms', document.uri.toString(), stepEnd[1] / 1000000);

		if (!containsConflict) {
			return [];
		}

		stepStart = process.hrtime();
		const conflicts = MergeConflictParser.scanDocument(document);
		stepEnd = process.hrtime(stepStart);

		console.info('%s -> Find conflict regions execution time: %dms', document.uri.toString(), stepEnd[1] / 1000000);

		return conflicts;
	}

	private getCacheKey(document: vscode.TextDocument): string | null {
		if (document.uri && document.uri) {
			return document.uri.toString();
		}

		return null;
	}
}