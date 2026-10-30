# Tests manuels : critères d'acceptation (section 13)

Environnement : stack locale (`supabase start`, `supabase db reset`, puis
`supabase functions serve --env-file supabase/functions/.env`) avec dans ce fichier :
`ALLOWED_ORIGINS=http://localhost:5173`, `UNSUBSCRIBE_SECRET=<32+ caractères>`, `EMAIL_DRY_RUN=true`,
`MAIL_FROM=Test <test@example.com>`, `SITE_URL=http://localhost:5173`.

Prérequis : `curl`, `jq`, `psql`. Réinitialiser avec `supabase db reset` entre deux campagnes complètes.

## 0. Variables et connexion

```bash
export API=http://127.0.0.1:54321
export FN=$API/functions/v1
export ANON_KEY=$(supabase status -o json | jq -r .ANON_KEY)
export DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

login() {
  curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"Password123!\"}" | jq -r .access_token
}
export OWNER_A=$(login owner-a@cafe-a.test)
export WAITER_A=$(login waiter-a@cafe-a.test)
export OWNER_B=$(login owner-b@cafe-b.test)

export CAFE_A=a0000000-0000-4000-8000-000000000001
export CAFE_B=b0000000-0000-4000-8000-000000000001
export TA1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001 TA2=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0002
export TA3=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0003 TA4=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0004
export TA5=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0005 TB1=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0001
export ESPRESSO_A=a2000000-0000-4000-8000-000000000001     # 180 centimes
export THE_GLACE_A=a2000000-0000-4000-8000-000000000007    # indisponible
export ESPRESSO_B=b2000000-0000-4000-8000-000000000001

rest() { curl -s "$API/rest/v1/$1" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $2" "${@:3}"; }
rpc()  { curl -s -w ' HTTP %{http_code}\n' -X POST "$API/rest/v1/rpc/$1" -H "apikey: $ANON_KEY" \
           -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
fn()   { curl -s -w ' HTTP %{http_code}\n' "$FN/$1" -H "Content-Type: application/json" "${@:2}"; }
reset_limits() { psql "$DB_URL" -qc "delete from public.rate_limit_hits"; }
```

Contrôle global : aucune table de `public` sans RLS ni policy (attendu : 0 ligne).
```bash
psql "$DB_URL" -c "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
    and (not c.relrowsecurity or not exists (select 1 from pg_policy p where p.polrelid=c.oid));"
```

---

## 1. Un employé du café A ne lit rien du café B

```bash
fn create-order -X POST -d "{\"token\":\"$TB1\",\"items\":[{\"product_id\":\"$ESPRESSO_B\",\"quantity\":1}]}"
for t in orders order_items table_sessions waiter_calls cafe_tables products categories staff_members announcements cafe_followers; do
  echo "$t : $(rest "$t?cafe_id=eq.$CAFE_B&select=*" "$WAITER_A")"
done
rest "cafes?id=eq.$CAFE_B" "$OWNER_A"
# Attendu : [] partout.
rest "products?id=eq.$ESPRESSO_B" "$OWNER_A" -X PATCH -H "Content-Type: application/json" \
  -H "Prefer: return=representation" -d '{"price_cents":1}'
# Attendu : [] (aucune ligne modifiée)
```
Variante SQL :
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
select count(*) from public.orders   where cafe_id = 'b0000000-0000-4000-8000-000000000001'; -- 0
select count(*) from public.products where cafe_id = 'b0000000-0000-4000-8000-000000000001'; -- 0
rollback;
```

## 2. Un anonyme ne peut pas écrire dans orders, order_items, waiter_calls, table_sessions

```bash
for t in orders order_items waiter_calls table_sessions; do
  echo "$t insert : $(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/$t" -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" -d "{\"cafe_id\":\"$CAFE_A\"}")"
  echo "$t update : $(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/rest/v1/$t?cafe_id=eq.$CAFE_A" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"status":"closed"}')"
done
# Attendu : 401 (permission denied) partout. Avec un JWT employé ($WAITER_A) : 403.
```

## 3. create-order : faux jeton → 404 ; produit d'un autre café → 404

```bash
reset_limits
fn create-order -X POST -d "{\"token\":\"ffffffffffffffffffffffffffffffffffff\",\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":1}]}"
fn create-order -X POST -d "{\"token\":\"pas-un-jeton\",\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":1}]}"
# Attendu : HTTP 404 table_not_found (x2)
fn create-order -X POST -d "{\"token\":\"$TA1\",\"items\":[{\"product_id\":\"$ESPRESSO_B\",\"quantity\":1}]}"
# Attendu : HTTP 404 product_not_found
```

## 4. Le prix envoyé par le client n'a aucun effet

```bash
fn create-order -X POST -d "{\"token\":\"$TA2\",\"total_cents\":1,\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":2,\"price_cents\":1,\"unit_price_cents\":1}]}"
# Attendu : HTTP 201, "order_total_cents":360 (2 x 180 lus en base)
```

## 5. Commander un produit indisponible est refusé

```bash
fn create-order -X POST -d "{\"token\":\"$TA2\",\"items\":[{\"product_id\":\"$THE_GLACE_A\",\"quantity\":1}]}"
# Attendu : HTTP 409 product_unavailable
```

## 6. Dépasser order_rate_limit → 429

```bash
reset_limits
for i in 1 2 3 4 5 6; do
  fn create-order -X POST -d "{\"token\":\"$TA3\",\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":1}]}"
done
# Attendu : 5 x HTTP 201 puis HTTP 429 table_rate_limited avec retry_after_seconds
```

## 7. Appel serveur idempotent, puis délai de répit

```bash
reset_limits
C1=$(curl -s -X POST "$FN/call-waiter" -H "Content-Type: application/json" -d "{\"token\":\"$TA4\"}" | jq -r .call.id)
C2=$(curl -s -X POST "$FN/call-waiter" -H "Content-Type: application/json" -d "{\"token\":\"$TA4\"}" | jq -r .call.id)
[ "$C1" = "$C2" ] && echo "OK même appel ($C1)"
rpc staff_handle_waiter_call "$WAITER_A" "{\"p_call_id\":\"$C1\"}"      # HTTP 200, status handled
fn call-waiter -X POST -d "{\"token\":\"$TA4\"}"
# Attendu : HTTP 429 waiter_call_cooldown (délai de 60 s)
```

## 8. cancel-order refuse une commande qui n'est plus pending

```bash
reset_limits
curl -s -X POST "$FN/create-order" -H "Content-Type: application/json" \
  -d "{\"token\":\"$TA4\",\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":1}]}" > /tmp/o.json
O=$(jq -r .order_id /tmp/o.json); K=$(jq -r .cancel_key /tmp/o.json)
fn cancel-order -X POST -d "{\"token\":\"$TA4\",\"order_id\":\"$O\",\"cancel_key\":\"00000000000000000000000000000000000f\"}"
# Attendu : HTTP 404 order_not_found (mauvaise clé : même réponse qu'une commande inconnue)
rpc staff_update_order_status "$WAITER_A" "{\"p_order_id\":\"$O\",\"p_new_status\":\"accepted\"}"
fn cancel-order -X POST -d "{\"token\":\"$TA4\",\"order_id\":\"$O\",\"cancel_key\":\"$K\"}"
# Attendu : HTTP 409 order_not_pending
fn cancel-order -X POST -d "{\"token\":\"$TA1\",\"order_id\":\"$O\",\"cancel_key\":\"$K\"}"
# Attendu : HTTP 404 order_not_found (commande d'une autre table)
```

## 9. Transition de statut invalide refusée

```bash
rpc staff_update_order_status "$WAITER_A" "{\"p_order_id\":\"$O\",\"p_new_status\":\"preparing\"}"  # 200
rpc staff_update_order_status "$WAITER_A" "{\"p_order_id\":\"$O\",\"p_new_status\":\"served\"}"     # 200
rpc staff_update_order_status "$WAITER_A" "{\"p_order_id\":\"$O\",\"p_new_status\":\"pending\"}"
# Attendu : HTTP 400, message invalid_transition (served -> pending)
```

## 10. get-table-state isolé par table ; total à 0 après clôture ou péremption

```bash
reset_limits
R=$(curl -s -X POST "$FN/create-order" -H "Content-Type: application/json" \
  -d "{\"token\":\"$TA1\",\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":1}]}")
S=$(echo "$R" | jq -r .session_id)
curl -s "$FN/get-table-state?token=$TA1" | jq '{session: .session.id, total: .total_cents, n: (.orders|length)}'
curl -s "$FN/get-table-state?token=$TA2" | jq '[.orders[].id]'
# Attendu : la liste de la table 2 ne contient aucune commande de la table 1.

# a) Clôture par le personnel
rpc staff_close_session "$WAITER_A" "{\"p_session_id\":\"$S\"}"
curl -s "$FN/get-table-state?token=$TA1" | jq '{session, total_cents, orders}'
# Attendu : session null, total_cents 0, orders []
curl -s -X POST "$FN/create-order" -H "Content-Type: application/json" \
  -d "{\"token\":\"$TA1\",\"items\":[{\"product_id\":\"$ESPRESSO_A\",\"quantity\":1}]}" | jq .session_total_cents
# Attendu : 180 (nouvelle session, repartie de 0)

# b) Péremption (session_stale_hours = 3)
psql "$DB_URL" -c "update public.table_sessions set last_activity_at = now() - interval '4 hours'
  where table_id = 'a3000000-0000-4000-8000-000000000001' and status = 'open';"
curl -s "$FN/get-table-state?token=$TA1" | jq '{session, total_cents}'
# Attendu : session null, total_cents 0
```

## 11. Après staff_regenerate_table_token, l'ancien jeton → 404

```bash
rpc staff_regenerate_table_token "$OWNER_A" '{"p_table_id":"a3000000-0000-4000-8000-000000000005"}'
fn "get-menu?token=$TA5"
# Attendu : HTTP 404 table_not_found (le nouveau jeton est dans la réponse RPC)
```

## 12. create-staff : refusé pour manager/waiter ; owner limité à manager|waiter de son café

```bash
reset_limits
fn create-staff -X POST -H "Authorization: Bearer $WAITER_A" -d '{"email":"x1@cafe-a.test","display_name":"X","role":"waiter"}'
# Attendu : HTTP 403 forbidden_role

psql "$DB_URL" -c "update public.staff_members set role='manager' where id='00000000-0000-4000-8000-00000000a002';"
fn create-staff -X POST -H "Authorization: Bearer $WAITER_A" -d '{"email":"x2@cafe-a.test","display_name":"X","role":"waiter"}'
# Attendu : HTTP 403 forbidden_role (manager)
psql "$DB_URL" -c "update public.staff_members set role='waiter' where id='00000000-0000-4000-8000-00000000a002';"

fn create-staff -X POST -H "Authorization: Bearer $OWNER_A" -d '{"email":"x3@cafe-a.test","display_name":"X","role":"owner"}'
# Attendu : HTTP 400 validation_error

fn create-staff -X POST -H "Authorization: Bearer $OWNER_A" \
  -d "{\"email\":\"x4@cafe-a.test\",\"display_name\":\"Léa\",\"role\":\"waiter\",\"cafe_id\":\"$CAFE_B\"}"
# Attendu : HTTP 201, staff_member.cafe_id = a0000000-… (café A : cafe_id envoyé ignoré)
```

## 13. send-announcement : pas de double envoi, rien aux désabonnés

```bash
psql "$DB_URL" -c "select * from public.announcement_recipients('$CAFE_A', null, 100);"
# Attendu : uniquement client1@example.test (client2 est désabonné)
ANN=a4000000-0000-4000-8000-000000000001
fn send-announcement -X POST -H "Authorization: Bearer $OWNER_A" -d "{\"announcement_id\":\"$ANN\"}"
# Attendu : HTTP 200, sent_count 1
fn send-announcement -X POST -H "Authorization: Bearer $OWNER_A" -d "{\"announcement_id\":\"$ANN\"}"
# Attendu : HTTP 409 announcement_already_sent
fn send-announcement -X POST -H "Authorization: Bearer $WAITER_A" -d "{\"announcement_id\":\"$ANN\"}"
# Attendu : HTTP 403 forbidden_role
```
Désabonnement par lien signé (sans Resend) : générer un jeton et l'appeler.
```bash
SECRET=<UNSUBSCRIBE_SECRET>; CUST=00000000-0000-4000-8000-00000000c001
SIG=$(printf '%s' "$CUST:$CAFE_A" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64 | tr '+/' '-_' | tr -d '=')
curl -s "$FN/unsubscribe?t=$CUST.$CAFE_A.$SIG"                                             # GET : {"unsubscribed":false}
curl -s -X POST "$FN/unsubscribe?t=$CUST.$CAFE_A.$SIG"                                      # POST : {"unsubscribed":true}
curl -s -o /dev/null -w '%{http_code}\n' "$FN/unsubscribe?t=$CUST.$CAFE_A.AAAA"            # 400
psql "$DB_URL" -c "select * from public.announcement_recipients('$CAFE_A', null, 100);"      # 0 ligne

# Compte non confirmé : aucun destinataire (client4 est non confirmé en seed)
psql "$DB_URL" -c "select * from public.announcement_recipients('$CAFE_A', null, 100);" | grep -c client4   # Attendu : 0
psql "$DB_URL" -c "select count(*) from public.cafe_followers where customer_id='00000000-0000-4000-8000-00000000c004';"  # Attendu : 0

# Panne Resend : aucun email transmis -> 502 et annonce repasse en draft
psql "$DB_URL" -c "update public.announcements set status='draft', sending_started_at=null where id='$ANN';"
# Relancer la fonction avec RESEND_API_KEY=invalide et EMAIL_DRY_RUN absent
# Attendu : HTTP 502 send_failed, puis status = draft dans announcements (quota non consommé)
```

## 14. Un employé du café A ne peut pas téléverser dans le dossier du café B

```bash
printf '\x89PNG\r\n\x1a\n' > /tmp/test.png
curl -s -w ' HTTP %{http_code}\n' -X POST "$API/storage/v1/object/cafe-assets/$CAFE_B/products/test.png" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_A" -H "Content-Type: image/png" --data-binary @/tmp/test.png
# Attendu : refus (HTTP 400/403, "new row violates row-level security policy")
curl -s -w ' HTTP %{http_code}\n' -X POST "$API/storage/v1/object/cafe-assets/$CAFE_A/products/test.png" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_A" -H "Content-Type: image/png" --data-binary @/tmp/test.png
# Contrôle positif : HTTP 200
curl -s -w ' HTTP %{http_code}\n' -X POST "$API/storage/v1/object/cafe-assets/$CAFE_A/products/t2.png" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $WAITER_A" -H "Content-Type: image/png" --data-binary @/tmp/test.png
# Attendu : refus (un waiter ne téléverse pas)
```

## 15. Un employé désactivé perd tout accès immédiatement

```bash
rpc owner_set_staff_active "$OWNER_A" '{"p_staff_id":"00000000-0000-4000-8000-00000000a002","p_active":false}'
rest "orders?select=id&limit=1" "$WAITER_A"                                       # Attendu : []
rest "products?select=id&limit=1" "$WAITER_A"                                     # Attendu : []
rpc staff_set_product_availability "$WAITER_A" "{\"p_product_id\":\"$ESPRESSO_A\",\"p_available\":false}"
# Attendu : HTTP 403 forbidden
rpc owner_set_staff_active "$OWNER_A" '{"p_staff_id":"00000000-0000-4000-8000-00000000a001","p_active":false}'
# Attendu : HTTP 409 cannot_deactivate_self
rpc owner_set_staff_active "$OWNER_A" '{"p_staff_id":"00000000-0000-4000-8000-00000000a002","p_active":true}'
```
(Même JWT réutilisé : la désactivation est effective sans attendre son expiration.)
