import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {join} from 'node:path';import {load,ops,byId,mutate,negative,check,root} from './helpers.mjs';
const d=load();
const rows=`get /health/live getLiveness P04 global none
get /health/ready getReadiness P04 global none
get /session getSession P06 global optional
post /auth/sign-up signUp P06 auth-email anon+csrf
post /auth/verify-email verifyEmail P06 global anon+csrf
post /auth/resend-verification resendVerification P06 auth-email anon+csrf
post /auth/login login P06 auth-login anon+csrf
post /auth/logout logout P06 global session+csrf
post /auth/password-reset/request requestPasswordReset P06 auth-email anon+csrf
post /auth/password-reset/confirm confirmPasswordReset P06 global anon+csrf
post /auth/reauthenticate reauthenticate P06 auth-login session+csrf
put /account/password changePassword P06 global session+csrf+reauth
delete /account requestAccountDeletion P06 global session+csrf+reauth
get /account/data-export exportAccountData P06 data-export session+reauth+verified
get /resumes listResumes P07 global session
post /resumes createResume P07 doc-write session+csrf
get /resumes/{resumeId} getResume P07 global session
put /resumes/{resumeId}/document replaceResumeDocument P07 doc-write session+csrf
delete /resumes/{resumeId} trashResume P07 doc-write session+csrf
post /resumes/{resumeId}/restore restoreResume P07 doc-write session+csrf
post /resumes/{resumeId}/purge purgeResume P07 doc-write session+csrf
get /resumes/{resumeId}/snapshots listSnapshots P07 global session
post /resumes/{resumeId}/snapshots createSnapshot P07 doc-write session+csrf
get /resumes/{resumeId}/snapshots/{snapshotId} getSnapshot P07 global session
post /resumes/{resumeId}/photo uploadPhoto P07 photo-upload session+csrf
put /resumes/{resumeId}/photo/crop updatePhotoCrop P07 doc-write session+csrf
delete /resumes/{resumeId}/photo removePhoto P07 doc-write session+csrf
get /resumes/{resumeId}/photo/rendition getPhotoRendition P07 global session
get /resumes/{resumeId}/photo/master getPhotoMaster P07 global session
post /client-events reportClientEvents P11 client-events session+csrf
post /resume-imports/structure structureResumeImport IMP-01 resume-import session+csrf`.split('\n').map(x=>x.split(' '));
const security={none:[],optional:[{}, {sessionCookie:[]}], 'anon+csrf':[{csrfHeader:[]}],session:[{sessionCookie:[]}], 'session+csrf':[{sessionCookie:[],csrfHeader:[]}]};
const norm=s=>JSON.stringify(s.map(x=>Object.keys(x).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
function inventory(doc){const v=[];const actual=ops(doc),expected=new Map(rows.map(([m,p,id,ph,pol,auth])=>[`${m} ${p}`,{id,ph,pol,auth}]));for(const o of actual){const k=`${o.method} ${o.path}`,e=expected.get(k);if(!e){v.push(`extra operation ${k}`);continue;}if(o.op.operationId!==e.id||o.op['x-phase']!==e.ph||o.op['x-rate-limit-policy']!==e.pol||norm(o.security)!==norm(security[e.auth.replace(/\+(reauth|verified)/g,'')])||!!o.op['x-requires-reauth']!==e.auth.includes('reauth')||!!o.op['x-requires-verified-email']!==e.auth.includes('verified'))v.push(`${e.id} inventory mismatch`);expected.delete(k);}for(const [k,e] of expected)v.push(`${e.id} missing ${k}`);return v;}
function excludedTokens(doc){const bad=new Set('pdf txt docx export import imports share publish ai suggest suggestions score payment template templates'.split(' '));return Object.keys(doc.paths).flatMap(p=>p==='/account/data-export'||p==='/resume-imports/structure'?[]:p.split(/[\/-]/).filter(t=>bad.has(t)).map(t=>`${p}: excluded ${t}`));}
const anon=new Set('getLiveness getReadiness getSession signUp verifyEmail resendVerification login requestPasswordReset confirmPasswordReset'.split(' '));
function anonAllowList(doc){const found=new Set(ops(doc).filter(o=>!o.security.length||o.security.some(s=>!Object.hasOwn(s,'sessionCookie'))).map(o=>o.op.operationId));return [...new Set([...anon,...found])].filter(x=>anon.has(x)!==found.has(x)).map(x=>`${x} anonymous mismatch`);}
function schemes(doc){return [['sessionCookie','cookie','__Host-rb_session'],['csrfHeader','header','X-XSRF-TOKEN']].flatMap(([n,loc,name])=>{const s=doc.components.securitySchemes[n];return s?.type==='apiKey'&&s.in===loc&&s.name===name?[]:[`${n} scheme mismatch`];});}
function csrfOnUnsafe(doc){return ops(doc).filter(o=>['post','put','patch','delete'].includes(o.method)&&(!o.security.length||o.security.some(s=>!Object.hasOwn(s,'csrfHeader')))).map(o=>`${o.op.operationId} missing csrfHeader`);}
function authNeeds401(doc){return ops(doc).filter(o=>!anon.has(o.op.operationId)&&!o.op.responses['401']).map(o=>`${o.op.operationId} missing 401`);}
function unsafeNeeds403(doc){return ops(doc).filter(o=>['post','put','patch','delete'].includes(o.method)&&!o.op.responses['403']).map(o=>`${o.op.operationId} missing 403`);}
function reauth(doc){return ops(doc).filter(o=>!!o.op['x-requires-reauth']!==['changePassword','requestAccountDeletion','exportAccountData'].includes(o.op.operationId)).map(o=>`${o.op.operationId} reauth mismatch`);}
function verified(doc){return ops(doc).filter(o=>!!o.op['x-requires-verified-email']!==(o.op.operationId==='exportAccountData')||(o.op.operationId==='exportAccountData'&&!o.op.responses['403'])).map(o=>`${o.op.operationId} verified mismatch`);}
function xPhaseSet(doc){return ops(doc).filter(o=>!new Set(['P04','P06','P07','P11','IMP-01']).has(o.op['x-phase'])).map(o=>`${o.op.operationId} invalid x-phase`);}
const logPath=join(root,'contracts/openapi/CHANGELOG.md'),phasePath='docs/phases/P02/architecture/contract-changelog.md';function changelog(s=readFileSync(logPath,'utf8')){const line=s.split('\n').find(x=>/^#{1,6}\s/.test(x)&&x.includes('1.0.0'));return [...(!line?['CHANGELOG.md missing 1.0.0 heading']:[]),...(!s.includes(phasePath)?[`CHANGELOG.md missing ${phasePath}`]:[]),...(!existsSync(join(root,phasePath))?[`missing ${phasePath}`]:[])];}
for(const [id,fn] of Object.entries({inventory,excludedTokens,anonAllowList,schemes,csrfOnUnsafe,authNeeds401,unsafeNeeds403,reauth,verified,xPhaseSet}))test(`AC-P02-03/06/13 positive ${id}`,()=>check(id,fn,d));test('AC-P02-13 positive changelog',()=>assert.deepEqual(changelog(),[]));
test('N-03 extra pdf operation',()=>{const m=mutate(d,x=>{const o=byId(x,'createResume').op;x.paths['/resumes/{resumeId}/pdf']={post:{...structuredClone(o),operationId:'exportPdf'}}});assert.match(inventory(m).join(),/pdf/);assert.match(excludedTokens(m).join(),/pdf/);console.log('N-03:',inventory(m),excludedTokens(m));});
test('N-04 missing snapshot',()=>negative('N-04',inventory,d,x=>{delete x.paths['/resumes/{resumeId}/snapshots/{snapshotId}'].get},'getSnapshot'));
test('N-09 csrf',()=>negative('N-09',csrfOnUnsafe,d,x=>{byId(x,'replaceResumeDocument').op.security=[{sessionCookie:[]}]},'replaceResumeDocument'));
test('N-10 anonymous',()=>{const m=mutate(d,x=>{byId(x,'listResumes').op.security=[]});assert.match(anonAllowList(m).join(),/listResumes/);assert.match(inventory(m).join(),/listResumes/);console.log('N-10:',anonAllowList(m),inventory(m));});
test('N-21 x-phase',()=>negative('N-21',xPhaseSet,d,x=>{byId(x,'getLiveness').op['x-phase']='P05'},'getLiveness'));
test('N-23 changelog heading',()=>{const s=readFileSync(logPath,'utf8').replace(/^#{1,6}\s.*1\.0\.0.*$/m,'');assert.match(changelog(s).join(),/CHANGELOG.md missing 1.0.0/);console.log('N-23:',changelog(s));});
test('N-IMP-01 another import path is still excluded (DD-IMP-03)',()=>{const m=mutate(d,x=>{x.paths['/resume-imports/parse']=structuredClone(x.paths['/resume-imports/structure'])});assert.match(excludedTokens(m).join(),/\/resume-imports\/parse: excluded imports/);console.log('N-IMP-01:',excludedTokens(m));});
