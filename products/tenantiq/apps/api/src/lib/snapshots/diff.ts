/**
 * Config Diff Engine — compares two snapshots to find changes.
 */

export interface DiffEntry {
	path: string;
	type: 'added' | 'removed' | 'changed';
	oldValue?: unknown;
	newValue?: unknown;
}

export interface CategoryDiff {
	categoryId: string;
	name: string;
	changes: DiffEntry[];
	changeCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- recursive object comparison requires dynamic access
function diffObjects(oldObj: any, newObj: any, prefix = ''): DiffEntry[] {
	const diffs: DiffEntry[] = [];
	if (oldObj === newObj) return diffs;
	if (oldObj == null && newObj == null) return diffs;
	if (oldObj == null) return [{ path: prefix || '(root)', type: 'added', newValue: newObj }];
	if (newObj == null) return [{ path: prefix || '(root)', type: 'removed', oldValue: oldObj }];

	if (typeof oldObj !== typeof newObj) {
		return [{ path: prefix || '(root)', type: 'changed', oldValue: oldObj, newValue: newObj }];
	}

	if (typeof oldObj !== 'object') {
		if (oldObj !== newObj) diffs.push({ path: prefix || '(root)', type: 'changed', oldValue: oldObj, newValue: newObj });
		return diffs;
	}

	if (Array.isArray(oldObj) && Array.isArray(newObj)) {
		if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
			diffs.push({ path: prefix || '(root)', type: 'changed', oldValue: `Array[${oldObj.length}]`, newValue: `Array[${newObj.length}]` });
		}
		return diffs;
	}

	const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
	for (const key of allKeys) {
		const p = prefix ? `${prefix}.${key}` : key;
		if (!(key in oldObj)) { diffs.push({ path: p, type: 'added', newValue: newObj[key] }); continue; }
		if (!(key in newObj)) { diffs.push({ path: p, type: 'removed', oldValue: oldObj[key] }); continue; }
		diffs.push(...diffObjects(oldObj[key], newObj[key], p));
	}
	return diffs;
}

export function diffSnapshots(
	oldCategories: Array<{ categoryId: string; name: string; data: unknown }>,
	newCategories: Array<{ categoryId: string; name: string; data: unknown }>,
): CategoryDiff[] {
	const results: CategoryDiff[] = [];

	for (const newCat of newCategories) {
		const oldCat = oldCategories.find(c => c.categoryId === newCat.categoryId);
		const changes = diffObjects(oldCat?.data ?? null, newCat.data);
		results.push({ categoryId: newCat.categoryId, name: newCat.name, changes, changeCount: changes.length });
	}

	for (const oldCat of oldCategories) {
		if (!newCategories.find(c => c.categoryId === oldCat.categoryId)) {
			results.push({ categoryId: oldCat.categoryId, name: oldCat.name, changes: [{ path: '(entire category)', type: 'removed' }], changeCount: 1 });
		}
	}

	return results.filter(r => r.changeCount > 0);
}
