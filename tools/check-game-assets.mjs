import {existsSync} from 'node:fs';
const paths=['tools/gold-v6-blender.geometry.json','tools/white-v6-blender.geometry.json','shared/undersea-geometry.json','shared/beach-swim-geometry.json','shared/swim-geometry.json','source-assets/environment','public/assets'];
const missing=paths.filter(p=>!existsSync(p));
if(missing.length){console.error('Two Tails is a code-only release. Supply your own licensed assets and scene data. See ASSETS.md. Missing:\n'+missing.join('\n'));process.exit(1);}
