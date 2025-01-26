/*
 Target Server Type    : PostgreSQL
 Target Server Version : 110009
 File Encoding         : 65001
*/

-- ----------------------------
-- Extension pgcrypto
-- ----------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------
-- Function structure for generate_snowflake
-- ----------------------------
CREATE OR REPLACE FUNCTION "public"."generate_snowflake"(IN "seq" text, OUT "snowflake" int8)
  RETURNS "pg_catalog"."int8" AS $BODY$
DECLARE
    our_epoch bigint := 1314220021721;
    seq_id bigint;
    now_millis bigint;
    -- the id of this DB shard, must be set for each
    -- schema shard you have - you could pass this as a parameter too
    shard_id int := 1;
BEGIN
    SELECT nextval(seq) % 1024 INTO seq_id;

    SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000) INTO now_millis;
    snowflake := (now_millis - our_epoch) << 23;
    snowflake := snowflake | (shard_id << 10);
    snowflake := snowflake | (seq_id);
END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

-- ----------------------------
-- Function structure for random_string
-- ----------------------------
CREATE OR REPLACE FUNCTION "public"."random_string"("length" int4)
  RETURNS "pg_catalog"."varchar" AS $BODY$
declare
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z}';
  result varchar := '';
  i integer := 0;
begin
  for i in 1..length loop
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  end loop;
  return result;
end;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

-- ----------------------------
-- Type structure for GrantResult
-- ----------------------------
DROP TYPE IF EXISTS "public"."GrantResult";
CREATE TYPE "public"."GrantResult" AS ENUM (
  'GRANTED',
  'DENIED',
  'REVOKED'
);

-- ----------------------------
-- Sequence structure for apps_id_sequence
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."apps_id_sequence";
CREATE SEQUENCE "public"."apps_id_sequence"
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for apps_secret_sequence
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."apps_secret_sequence";
CREATE SEQUENCE "public"."apps_secret_sequence"
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for grants_id_sequence
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."grants_id_sequence";
CREATE SEQUENCE "public"."grants_id_sequence"
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for icons_id_sequence
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."icons_id_sequence";
CREATE SEQUENCE "public"."icons_id_sequence"
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Table structure for accounts
-- ----------------------------
DROP TABLE IF EXISTS "public"."accounts";
CREATE TABLE "public"."accounts" (
  "id" varchar(32) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(128) COLLATE "pg_catalog"."default" NOT NULL,
  "email" varchar(255) COLLATE "pg_catalog"."default",
  "email_pending" varchar(255) COLLATE "pg_catalog"."default",
  "email_pending_since" timestamptz(0),
  "last_login" timestamptz(0)
);

-- ----------------------------
-- Table structure for apps
-- ----------------------------
DROP TABLE IF EXISTS "public"."apps";
CREATE TABLE "public"."apps" (
  "id" int8 NOT NULL DEFAULT generate_snowflake('public.apps_id_sequence'::text),
  "owner" varchar(32) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(128) COLLATE "pg_catalog"."default" NOT NULL,
  "description" varchar(512) COLLATE "pg_catalog"."default",
  "website" varchar(512) COLLATE "pg_catalog"."default" NOT NULL DEFAULT '[]'::character varying,
  "icon" int8,
  "redirect_uris" jsonb NOT NULL DEFAULT '[]'::jsonb,
--   FIXME: Generate secret similar to new access and exchange tokens
  "secret" varchar(255) COLLATE "pg_catalog"."default" DEFAULT concat(random_string(8), '.', generate_snowflake('public.apps_secret_sequence'::text), '.', random_string(4)),
  "verified" bool NOT NULL DEFAULT false,
  "deleted" bool NOT NULL DEFAULT false,
  "created" timestamptz(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Table structure for grants
-- ----------------------------
DROP TABLE IF EXISTS "public"."grants";
CREATE TABLE "public"."grants" (
  "id" int8 NOT NULL DEFAULT generate_snowflake('public.grants_id_sequence'::text),
  "app" int8 NOT NULL,
  "account" varchar(32) COLLATE "pg_catalog"."default" NOT NULL,
  "result" "public"."GrantResult",
  "scopes" jsonb NOT NULL,
  "response_type" varchar(128) COLLATE "pg_catalog"."default" NOT NULL,
  "state" varchar(128) COLLATE "pg_catalog"."default",
  "access_token" varchar(37) COLLATE "pg_catalog"."default",
  "exchange_token" varchar(37) COLLATE "pg_catalog"."default",
  "redirect_uri" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,
  "issued" timestamptz(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Table structure for icons
-- ----------------------------
DROP TABLE IF EXISTS "public"."icons";
CREATE TABLE "public"."icons" (
  "id" int8 NOT NULL DEFAULT generate_snowflake('public.icons_id_sequence'::text),
  "optimized" bytea,
  "original" bytea,
  "duplicate_of" int8,
  "added_by" varchar(32) COLLATE "pg_catalog"."default" NOT NULL,
  "added" timestamptz(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Table structure for otps
-- ----------------------------
DROP TABLE IF EXISTS "public"."otps";
CREATE TABLE "public"."otps" (
  "account" varchar(32) COLLATE "pg_catalog"."default" NOT NULL,
  "code" int4 NOT NULL,
  "issued" timestamptz(0) DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE "public"."otps" IS 'OTPs or One-Time-Passwords';

-- ----------------------------
-- Table structure for alternate_otps
-- ----------------------------
DROP TABLE IF EXISTS "public"."alternate_otps";
CREATE TABLE "public"."alternate_otps" (
  "account" varchar(32) COLLATE "pg_catalog"."default" NOT NULL,
  "code_prefix" varchar(1) COLLATE "pg_catalog"."default" NOT NULL,
  "code" int4 NOT NULL,
  "issued" timestamptz(0) DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Table structure for sessions
-- ----------------------------
DROP TABLE IF EXISTS "public"."sessions";
CREATE TABLE "public"."sessions" (
  "sid" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."apps_id_sequence"
OWNED BY "public"."apps"."id";
ALTER SEQUENCE "public"."apps_secret_sequence"
OWNED BY "public"."apps"."secret";
ALTER SEQUENCE "public"."grants_id_sequence"
OWNED BY "public"."grants"."id";
ALTER SEQUENCE "public"."icons_id_sequence"
OWNED BY "public"."icons"."id";

-- ----------------------------
-- Primary Key structure for table accounts
-- ----------------------------
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table apps
-- ----------------------------
ALTER TABLE "public"."apps" ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table grants
-- ----------------------------
CREATE UNIQUE INDEX "grants_access_token_idx" ON "public"."grants" USING btree (
  "access_token" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "grants_exchange_token_idx" ON "public"."grants" USING btree (
  "exchange_token" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table grants
-- ----------------------------
ALTER TABLE "public"."grants" ADD CONSTRAINT "grants_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table icons
-- ----------------------------
CREATE UNIQUE INDEX "icons_digest_idx" ON "public"."icons" USING btree (
  digest(original, 'sha256'::text) "pg_catalog"."bytea_ops" ASC NULLS LAST
);
CREATE INDEX "icons_original_idx" ON "public"."icons" USING hash (
  "original" "pg_catalog"."bytea_ops"
);

-- ----------------------------
-- Primary Key structure for table icons
-- ----------------------------
ALTER TABLE "public"."icons" ADD CONSTRAINT "images_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table otps
-- ----------------------------
ALTER TABLE "public"."otps" ADD CONSTRAINT "otps_pkey" PRIMARY KEY ("account");

-- ----------------------------
-- Primary Key structure for table alternate_otps
-- ----------------------------
ALTER TABLE "public"."alternate_otps" ADD CONSTRAINT "alternate_otps_pkey" PRIMARY KEY ("account");

-- ----------------------------
-- Indexes structure for table sessions
-- ----------------------------
CREATE INDEX "IDX_session_expire" ON "public"."sessions" USING btree (
  "expire" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table sessions
-- ----------------------------
ALTER TABLE "public"."sessions" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");

-- ----------------------------
-- Foreign Keys structure for table apps
-- ----------------------------
ALTER TABLE "public"."apps" ADD CONSTRAINT "applications_icon_fkey" FOREIGN KEY ("icon") REFERENCES "public"."icons" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."apps" ADD CONSTRAINT "applications_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."accounts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table grants
-- ----------------------------
ALTER TABLE "public"."grants" ADD CONSTRAINT "grants_account_fkey" FOREIGN KEY ("account") REFERENCES "public"."accounts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."grants" ADD CONSTRAINT "grants_app_fkey" FOREIGN KEY ("app") REFERENCES "public"."apps" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table icons
-- ----------------------------
ALTER TABLE "public"."icons" ADD CONSTRAINT "images_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."accounts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."icons" ADD CONSTRAINT "images_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "public"."icons" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table otps
-- ----------------------------
ALTER TABLE "public"."otps" ADD CONSTRAINT "otps_account_fkey" FOREIGN KEY ("account") REFERENCES "public"."accounts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
