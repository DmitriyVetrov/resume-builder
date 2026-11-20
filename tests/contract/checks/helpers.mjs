import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as pathResolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {after} from 'node:test';
export const root=pathResolve(fileURLToPath(new URL('../../../',import.meta.url)));
export const work=join(root,'tests/contract/.work');
export const contract=join(root,'contracts/openapi/openapi.yaml');
export const bin=n=>join(root,'tests/contract/node_modules/.bin',n);
export const source=()=>readFileSync(contract,'utf8');
const temps=[]; after(()=>temps.forEach(d=>rmSync(d,{recursive:true,force:true})));
export function run(cmd,args=[],opts={}) { const p=spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000,env:{...process.env,REDOCLY_TELEMETRY:'off',DOTNET_CLI_TELEMETRY_OPTOUT:'1',...opts.env},...opts}); if(p.error?.code==='ENOENT') throw Error(`ENV_MISSING: ${cmd}`); if(p.error) throw p.error; return {status:p.status,stdout:p.stdout??'',stderr:p.stderr??''}; }
export function temp(value,name='spec.json') {const d=mkdtempSync(join(tmpdir(),'p02-contract-'));temps.push(d);const p=join(d,name);writeFileSync(p,typeof value==='string'?value:JSON.stringify(value));return p;}
export function load(){mkdirSync(work,{recursive:true});const p=run(bin('redocly'),['bundle',contract,'--output',join(work,'openapi.json')]);assert.equal(p.status,0,p.stdout+p.stderr);return JSON.parse(readFileSync(join(work,'openapi.json'),'utf8'));}
export function resolve(doc,node){let v=node;const seen=new Set();while(v?.$ref){assert.match(v.$ref,/^#\//);assert.ok(!seen.has(v.$ref),`cyclic ref ${v.$ref}`);seen.add(v.$ref);v=v.$ref.slice(2).split('/').reduce((x,k)=>x?.[k.replaceAll('~1','/').replaceAll('~0','~')],doc);assert.ok(v,`missing ref ${[...seen].at(-1)}`);}return v;}
export function ops(doc){const methods=['get','post','put','patch','delete','options','head','trace'];return Object.entries(doc.paths).sort(([a],[b])=>a.localeCompare(b)).flatMap(([path,item])=>methods.filter(m=>item[m]).map(method=>({path,method,op:item[method],pathItem:item,parameters:[...(item.parameters??[]),...(item[method].parameters??[])].map(p=>resolve(doc,p)),security:item[method].security??doc.security??[]})));}
export function byId(doc,id){const v=ops(doc).find(x=>x.op.operationId===id);assert.ok(v,`missing operation ${id}`);return v;}
export function mutate(doc,fn){const c=structuredClone(doc);fn(c);return c;}
export function need(x,label){assert.ok(x,`missing mutation target ${label}`);return x;}
export function walk(doc,node,visit,seen=new Set(),label='root'){if(!node||typeof node!=='object')return;if(node.$ref){if(seen.has(node.$ref))return;seen.add(node.$ref);return walk(doc,resolve(doc,node),visit,seen,node.$ref.split('/').at(-1));}visit(node,label);for(const [k,v] of Object.entries(node.properties??{}))walk(doc,v,visit,seen,k);for(const k of ['items','additionalProperties'])if(typeof node[k]==='object')walk(doc,node[k],visit,seen,k);for(const k of ['oneOf','anyOf','allOf'])for(const v of node[k]??[])walk(doc,v,visit,seen,k);}
export function check(name,fn,doc){const v=fn(doc);assert.deepEqual(v,[],`${name}: ${v.join('; ')}`);}
export function negative(id,fn,doc,mutation,item){const v=fn(mutate(doc,mutation));assert.ok(v.length&&v.some(s=>s.includes(item)),`${id} did not detect ${item}: ${v}`);console.log(`${id}: ${v.join('; ')}`);}
export const response=(doc,op,status)=>resolve(doc,op.responses[status]);
export const media=(doc,r)=>Object.entries(resolve(doc,r).content??{});
export const header=(doc,r,name)=>Object.entries(resolve(doc,r).headers??{}).find(([n])=>n.toLowerCase()===name.toLowerCase())?.[1];
export const param=(o,name,loc)=>o.parameters.find(p=>p.name?.toLowerCase()===name.toLowerCase()&&p.in===loc);
export const val=s=>s?.const??(s?.enum?.length===1?s.enum[0]:undefined);
export const example=(doc,m)=>m.example??resolve(doc,Object.values(m.examples??{})[0])?.value;
