-- BREAKING: несовместима с предыдущей версией API. Перед применением остановите api и web
-- (docker compose -f docker-compose.server.yml stop api web), примените миграцию, затем запустите новую версию (docs/deploy.md).
-- Причина: получатели принадлежат сейфу, глобальная уникальность контакта снимается, а старый код ищет и создаёт
-- получателей только по контакту (запись без сейфа, назначения на неподконтрольного получателя).
-- Получатели принадлежат сейфу, ключ получателя проходит путь заявлен → подтверждён владельцем (#167).

ALTER TABLE "recipient"
  ADD COLUMN "vault_id" UUID,
  ADD COLUMN "key_fingerprint" TEXT,
  ADD COLUMN "key_claimed_at" TIMESTAMP(3),
  ADD COLUMN "key_confirmed_fingerprint" TEXT,
  ADD COLUMN "key_confirmed_at" TIMESTAMP(3);

ALTER TABLE "block_recipient" ADD COLUMN "wrapped_for_fingerprint" TEXT;

-- Копии получателей по сейфам возможны только без прежней уникальности по контакту.
DROP INDEX "recipient_contact_key";

-- Прежние записи общие для сейфов. Для каждой пары (получатель, сейф) из существующих назначений
-- получатель становится записью этого сейфа: первая пара использует исходную строку, остальные получают копию,
-- назначения перенаправляются. Записи без назначений остаются с vault_id NULL (не удаляются; недоступны, чистка — #174).
DO $$
DECLARE
  pair RECORD;
  prev UUID := NULL;
  new_id UUID;
BEGIN
  FOR pair IN
    SELECT DISTINCT br.recipient_id AS rid, b.vault_id AS vid
    FROM block_recipient br
    JOIN block b ON b.id = br.block_id
    ORDER BY br.recipient_id, b.vault_id
  LOOP
    IF prev IS DISTINCT FROM pair.rid THEN
      UPDATE recipient SET vault_id = pair.vid WHERE id = pair.rid;
      prev := pair.rid;
    ELSE
      INSERT INTO recipient (id, contact, pubkey, verification_status, created_at, vault_id)
        SELECT gen_random_uuid(), contact, pubkey, verification_status, created_at, pair.vid FROM recipient WHERE id = pair.rid
        RETURNING id INTO new_id;
      UPDATE block_recipient br SET recipient_id = new_id
        FROM block b
        WHERE b.id = br.block_id AND br.recipient_id = pair.rid AND b.vault_id = pair.vid;
    END IF;
  END LOOP;
END $$;

-- Контакты приводятся к каноническому виду (нижний регистр, без пробельных символов по краям), как это делают новые запросы.
-- Обрезка — регулярным выражением, а не btrim: btrim срезает только пробелы, а JS trim() (им считаются адрес и отпечаток в коде) — любые пробельные.
-- Записи одного сейфа, совпавшие после приведения, сливаются в одну: остаётся запись с ключом (затем самая старая),
-- назначения остальных переносятся к ней (если такое назначение у неё уже есть — дубликат отбрасывается).
UPDATE recipient SET contact = lower(regexp_replace(contact, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g')) WHERE vault_id IS NULL;
DO $$
DECLARE
  grp RECORD;
  keeper UUID;
  other RECORD;
BEGIN
  FOR grp IN
    SELECT vault_id AS vid, lower(regexp_replace(contact, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g')) AS c
    FROM recipient WHERE vault_id IS NOT NULL
    GROUP BY 1, 2 HAVING count(*) > 1
  LOOP
    SELECT id INTO keeper FROM recipient
      WHERE vault_id = grp.vid AND lower(regexp_replace(contact, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g')) = grp.c
      ORDER BY (pubkey IS NOT NULL AND regexp_replace(pubkey, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g') <> '') DESC, created_at, id LIMIT 1;
    FOR other IN
      SELECT id FROM recipient WHERE vault_id = grp.vid AND lower(regexp_replace(contact, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g')) = grp.c AND id <> keeper
    LOOP
      UPDATE block_recipient br SET recipient_id = keeper
        WHERE br.recipient_id = other.id
          AND NOT EXISTS (SELECT 1 FROM block_recipient k WHERE k.block_id = br.block_id AND k.recipient_id = keeper);
      DELETE FROM block_recipient WHERE recipient_id = other.id;
      DELETE FROM recipient WHERE id = other.id;
    END LOOP;
  END LOOP;
END $$;
UPDATE recipient SET contact = lower(regexp_replace(contact, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g')) WHERE vault_id IS NOT NULL;

-- Унаследованный ключ никем не подтверждён: заявленным он считается, но подтверждённого отпечатка нет,
-- а прежние упаковки DEK (wrapped_for_fingerprint IS NULL) недействительны, пока владелец не подтвердит ключ и не назначит заново.
UPDATE "recipient"
SET key_fingerprint = encode(sha256(convert_to(regexp_replace(pubkey, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g'), 'UTF8')), 'hex'),
    key_claimed_at = created_at,
    verification_status = 'KeyClaimed'
WHERE pubkey IS NOT NULL AND regexp_replace(pubkey, E'^[\\s\\u00a0\\ufeff]+|[\\s\\u00a0\\ufeff]+$', '', 'g') <> '';
UPDATE "recipient" SET verification_status = 'Invited' WHERE verification_status <> 'KeyClaimed';

ALTER TABLE "recipient" ADD CONSTRAINT "ck_recipient_status" CHECK (verification_status IN ('Invited', 'KeyClaimed', 'KeyConfirmed'));
ALTER TABLE "recipient" ADD CONSTRAINT "ck_recipient_confirmed" CHECK (
  (verification_status = 'KeyConfirmed') = (key_confirmed_fingerprint IS NOT NULL AND key_confirmed_at IS NOT NULL)
);

CREATE UNIQUE INDEX "uq_recipient_vault_contact" ON "recipient"("vault_id", "contact");
CREATE INDEX "ix_recipient_vault_id" ON "recipient"("vault_id");
ALTER TABLE "recipient" ADD CONSTRAINT "recipient_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
