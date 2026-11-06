import { MigrationInterface, QueryRunner } from 'typeorm';

// Manual reference ranges, read by EntityReferenceService at each refresh.
// Boundaries must be UTC midnight so that the range holds only full days. The
// trigger keeps updated_at correct after a manual UPDATE (a column default
// does not).
export class EntityReferenceOverride1793700000004 implements MigrationInterface {
  name = 'EntityReferenceOverride1793700000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "entity_reference_override" ("broker_id" character varying NOT NULL, "entity_id" character varying NOT NULL, "ref_start" TIMESTAMP WITH TIME ZONE NOT NULL, "ref_end" TIMESTAMP WITH TIME ZONE, "reason" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_entity_reference_override" PRIMARY KEY ("broker_id", "entity_id"), CONSTRAINT "CHK_entity_reference_override_period" CHECK ("ref_end" IS NULL OR "ref_end" > "ref_start"), CONSTRAINT "CHK_entity_reference_override_midnight" CHECK (("ref_start" AT TIME ZONE 'UTC')::time = '00:00' AND ("ref_end" IS NULL OR ("ref_end" AT TIME ZONE 'UTC')::time = '00:00')))`,
    );
    await queryRunner.query(
      `CREATE FUNCTION "entity_reference_override_touch"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "entity_reference_override_touch" BEFORE UPDATE ON "entity_reference_override" FOR EACH ROW EXECUTE FUNCTION "entity_reference_override_touch"()`,
    );
    await queryRunner.query(
      `ALTER TABLE "entity_reference" ADD "reference_source" character varying NOT NULL DEFAULT 'default', ADD CONSTRAINT "CHK_entity_reference_source" CHECK ("reference_source" IN ('default', 'override'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "entity_reference" DROP COLUMN "reference_source"`,
    );
    await queryRunner.query(`DROP TABLE "entity_reference_override"`);
    await queryRunner.query(
      `DROP FUNCTION "entity_reference_override_touch"()`,
    );
  }
}
