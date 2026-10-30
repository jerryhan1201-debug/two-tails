// Local comparison only. Production keeps the installed trees until a complete
// same-route visual/performance comparison supports adopting the candidate.
export const previewTrees=Boolean(import.meta.env?.DEV&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('tree-prototype')==='1');

export const TREE_PROTOTYPE_ROOT='/artifacts/v17/tree-prototype/runtime/';
