import { createClient } from '@supabase/supabase-js';
import type {Party,Need,Guest,Pledge,Claim} from './demo';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key):null;
export const idempotencyKey=()=>crypto.randomUUID();
interface Snapshot extends Omit<Party,'date'|'time'|'location'|'needs'|'guests'|'pledges'|'claims'|'maybe'|'declined'> {startsAt:string;generalLocation:string;needs:(Omit<Need,'claimed'|'note'>&{claimedQuantity:number})[];paymentMethods:{label:string;url:string}[]}
interface Envelope {party:Snapshot;guest?:Guest;guests?:Guest[];pledges?:Pledge[];claims?:Claim[]}
function normalizeParty(snapshot:Snapshot,extra?:Envelope):Party{
 const date=new Date(snapshot.startsAt);const pad=(v:number)=>String(v).padStart(2,'0');
 const guests=extra?.guests||(extra?.guest?[extra.guest]:[]);
 return {...snapshot,date:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,time:`${pad(date.getHours())}:${pad(date.getMinutes())}`,location:snapshot.generalLocation,needs:snapshot.needs.filter(n=>n.kind==='item'||n.kind==='task').map(n=>({...n,claimed:n.claimedQuantity,note:n.kind==='task'?'A little help from a friend':'Thanks for bringing this'})),guests,pledges:(extra?.pledges||[]).map(p=>({...p,name:guests.find(g=>g.id===p.guestId)?.name||'Guest'})),claims:extra?.claims||[],maybe:guests.filter(g=>g.status==='maybe').length,declined:guests.filter(g=>g.status==='declined').length,updates:(snapshot.updates||[]).map(u=>typeof u==='string'?u:(u as {message:string}).message),paymentUrl:snapshot.paymentMethods?.[0]?.url,inviteToken:sessionStorage.getItem(`invite-${snapshot.id}`)||undefined};
}
const reads=new Set(['invitation','guest','dashboard','listParties','profile']);
export async function callApi<T>(action:string,payload:Record<string,unknown>):Promise<T>{
 if(!supabase)throw new Error('Live hosting needs Supabase configuration. You can explore the labeled demo.');
 const request=reads.has(action)?payload:{...payload,idempotencyKey:payload.idempotencyKey||idempotencyKey()};
 const {data,error}=await supabase.rpc('party_api',{action,payload:request});
 if(error)throw new Error(error.message);
 if(action==='rotateInvite'){sessionStorage.setItem(`invite-${payload.partyId}`,String(data.inviteToken));}
 if(action==='invitation')return normalizeParty(data as Snapshot) as T;
 if(action==='guest'||action==='dashboard')return normalizeParty((data as Envelope).party,data as Envelope) as T;
 if(action==='createParty'){const result=data as {party:Snapshot;inviteToken:string};sessionStorage.setItem(`invite-${result.party.id}`,result.inviteToken);return {...result,partyId:result.party.id} as T}
 return data as T;
}
