import {test} from 'node:test';import assert from 'node:assert/strict';import {load,run,bin,contract,temp,mutate,byId,resolve} from './helpers.mjs';const d=load();
const rootFields=x=>[...(x.openapi==='3.1.0'?[]:['openapi']),...(x.info?.version==='1.2.0'?[]:['info.version']),...(x.servers?.length===1&&x.servers[0]?.url==='/api/v1'?[]:['servers'])];
test('AC-P02-02 positive root fields',()=>assert.deepEqual(rootFields(d),[]));
test('N-25 second server',()=>{const x=structuredClone(d);x.servers.push({url:'/api/v2'});assert.deepEqual(rootFields(x),['servers']);console.log('N-25: servers');});
function lint(p){return run(bin('redocly'),['lint',p,'--config','tests/contract/redocly.yaml']);}
test('AC-P02-02 positive lint',()=>{const p=lint(contract);assert.equal(p.status,0,p.stdout+p.stderr);console.log('lint:',p.stdout.match(/(?:\d+ errors?.*|Your API description is valid.*)/g)?.join(' ')??'exit 0');});
test('N-01 missing operationId',()=>{const x=mutate(d,c=>{delete byId(c,'getResume').op.operationId});const p=lint(temp(x));assert.notEqual(p.status,0);assert.match(p.stdout+p.stderr,/operation-operationId/);console.log('N-01: operation-operationId');});
test('N-02 invalid example',()=>{const x=mutate(d,c=>{const m=resolve(c,byId(c,'getResume').op.responses['200']).content['application/json'];const e=m.example??resolve(c,Object.values(m.examples)[0]).value;assert.ok(e?.document);e.document.templateId='T9';});const p=lint(temp(x));assert.notEqual(p.status,0);assert.match(p.stdout+p.stderr,/no-invalid-media-type-examples/);console.log('N-02: no-invalid-media-type-examples');});
