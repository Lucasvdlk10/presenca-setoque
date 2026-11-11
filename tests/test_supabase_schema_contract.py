from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_DIR = ROOT / "supabase" / "migrations"


def load_migration():
    migrations = sorted(MIGRATION_DIR.glob("*.sql")) if MIGRATION_DIR.exists() else []
    if not migrations:
        raise AssertionError("No Supabase SQL migration exists yet")
    raw = "\n".join(path.read_text(encoding="utf-8") for path in migrations).lower()
    return " ".join(raw.split())


class SupabaseSchemaContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = load_migration()

    def require_sql(self, fragment):
        if fragment not in self.sql:
            self.fail(f"Missing SQL contract: {fragment!r}")

    def forbid_sql(self, fragment):
        if fragment in self.sql:
            self.fail(f"Unsafe SQL contract present: {fragment!r}")

    def test_normalized_operational_tables_and_keys_exist(self):
        for table in (
            "private.app_user_roles",
            "public.app_profiles",
            "public.participants",
            "public.meetings",
            "public.attendance",
        ):
            with self.subTest(table=table):
                self.require_sql(f"create table {table}")
        self.require_sql("unique (meeting_id, participant_id)")
        self.require_sql("references public.participants(id)")
        self.require_sql("references public.meetings(id)")

    def test_sensitive_tables_require_active_admin_rls(self):
        for table in ("app_profiles", "participants", "meetings", "attendance"):
            with self.subTest(table=table):
                self.assertRegex(
                    self.sql,
                    rf"alter table public\.{table} enable row level security",
                )
        self.require_sql("create function public.is_active_admin()")
        self.assertIn("public.is_active_admin()", self.sql)
        self.assertIn("to authenticated", self.sql)
        self.require_sql("from public, anon")

    def test_private_photo_storage_is_not_public(self):
        self.assertIn("participant-photos", self.sql)
        self.require_sql(
            "insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) "
            "values ('participant-photos', 'participant-photos', false"
        )
        self.assertIn("storage.objects", self.sql)
        self.assertIn("bucket_id = 'participant-photos'", self.sql)
        self.assertIn("public.is_active_admin()", self.sql)

    def test_attendance_batch_rpc_is_atomic_and_validates_schedule(self):
        self.require_sql("create function public.save_attendance_batch")
        self.assertIn("jsonb_to_recordset", self.sql)
        self.assertIn("extract(isodow from p_meeting_date)", self.sql)
        self.assertIn("on conflict (meeting_id, participant_id) do update", self.sql)
        self.assertRegex(self.sql, r"delete from public\.attendance")
        self.assertIn("security invoker", self.sql)

    def test_analytics_star_views_are_read_only_layers(self):
        for view in (
            "analytics.dim_date",
            "analytics.dim_participant",
            "analytics.dim_meeting",
            "analytics.fact_attendance",
        ):
            with self.subTest(view=view):
                self.require_sql(f"create view {view}")
        self.assertIn("security_invoker = true", self.sql)

    def test_initial_migration_fails_closed_on_existing_objects(self):
        for statement in (
            "create schema if not exists",
            "create table if not exists",
            "create index if not exists",
            "create or replace function",
            "create or replace view",
        ):
            with self.subTest(statement=statement):
                self.forbid_sql(statement)

    def test_migration_contains_no_embedded_credentials(self):
        for pattern in (r"sb_secret_[a-z0-9]+", r"sbp_[a-z0-9]+", r"service_role_key\s*="):
            with self.subTest(pattern=pattern):
                self.assertIsNone(re.search(pattern, self.sql))


if __name__ == "__main__":
    unittest.main()
