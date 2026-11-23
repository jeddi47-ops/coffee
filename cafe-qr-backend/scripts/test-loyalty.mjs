import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;create type public.staff_role as enum('owner','manager','waiter');create table cafes(id uuid primary key,name text,logo_path text);create table customers(id uuid primary key,email text,display_name text);create table staff_members(id uuid primary key,cafe_id uuid,role staff_role,display_name text);create function public.generate_qr_token() returns text language sql as $$select md5(random()::text)||'abcd'$$;create function public.current_staff_cafe_id() returns uuid language sql as $$select cafe_id from public.staff_members where id=auth.uid()$$;create function public.current_staff_role() returns staff_role language sql as $$select role from public.staff_members where id=auth.uid()$$;create function public.is_cafe_active(uuid) returns boolean language sql as $$select true$$;`,
);
const util = readFileSync(
  new URL("../supabase/migrations/0003_functions.sql", import.meta.url),
  "utf8",
);
await db.exec(util.slice(0, util.indexOf("-- Addition indicative")));
await db.exec(
  readFileSync(
    new URL(
      "../supabase/migrations/20261123104604_loyalty_program.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const owner = "00000000-0000-4000-8000-000000000001",
  waiter = "00000000-0000-4000-8000-000000000002",
  customer = "00000000-0000-4000-8000-000000000003",
  cafe = "00000000-0000-4000-8000-000000000004",
  other = "00000000-0000-4000-8000-000000000005";
await db.exec(
  `insert into auth.users values ('${owner}'),('${waiter}'),('${customer}');insert into cafes values ('${cafe}','Café',null),('${other}','Autre',null);insert into customers values('${customer}','test@example.com','Client');insert into staff_members values('${owner}','${cafe}','owner','Patron'),('${waiter}','${cafe}','waiter','Serveur');insert into loyalty_programs(cafe_id,enabled,rule,reward) values('${cafe}',true,'1 café = 1 tampon','Un café');`,
);
const login = async (id) =>
  db.query("select set_config('app.uid',$1,false)", [id]);
const call = async (
  action,
  token,
  card = null,
  delta = 0,
  request = crypto.randomUUID(),
) =>
  (
    await db.query("select loyalty_action($1,$2,$3,$4,$5,$6) as result", [
      action,
      request,
      token,
      card,
      delta,
      "Correction",
    ])
  ).rows[0].result;
await login(customer);
const account = (await db.query("select loyalty_account() as a")).rows[0].a;
assert.equal(account.cards.length, 0);
await assert.rejects(() => call("scan", account.token));
await login(waiter);
let req = crypto.randomUUID();
let card = await call("scan", account.token, null, 0, req);
assert.equal(card.stamps, 1);
assert.equal((await call("scan", account.token, null, 0, req)).stamps, 1);
await assert.rejects(() => call("scan", account.token));
await assert.rejects(() => call("adjust", null, card.id, 11));
await assert.rejects(() => call("reward", account.token));
await login(owner);
card = await call("adjust", null, card.id, 11);
assert.equal(card.stamps, 12);
await login(waiter);
card = await call("reward", account.token);
assert.equal(card.stamps, 2);
await login(owner);
await call("adjust", null, card.id, 6);
await db.exec(
  `update loyalty_cards set last_visit_at=now()-interval '20 days';insert into loyalty_push values('${customer}','https://fcm.googleapis.com/test-endpoint','123456789012345678901234','12345678');`,
);
assert.equal(
  (await db.query("select loyalty_claim_reminders() as r")).rows[0].r.length,
  1,
);
assert.equal(
  (await db.query("select loyalty_claim_reminders() as r")).rows[0].r.length,
  0,
);
await login(waiter);
await call("scan", account.token);
assert.equal(
  (await db.query("select reminded_at from loyalty_cards")).rows[0].reminded_at,
  null,
);
await db.exec(
  `update staff_members set cafe_id='${other}' where id='${owner}';`,
);
await login(owner);
await assert.rejects(() => call("adjust", null, card.id, 1));
await db.exec("set role authenticated");
await assert.rejects(() => db.query("update loyalty_cards set stamps=99"));
await db.exec("reset role");
console.log(
  "PASS: schema, customer authorization, scan idempotency, cooldown, owner-only adjustment, reward carryover, reminder once/reset, tenant isolation, denied direct writes",
);
await db.close();
