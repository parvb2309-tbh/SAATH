"""Migration script to migrate existing SQLite user accounts, profiles, consents, and Career DNA into MongoDB."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app import config, mongo, security

SQLITE_DB = Path(os.getenv("SAATH_DB", Path(__file__).resolve().parent / "saath.db"))

DEMO_ACCOUNTS = {
    "student": {
        "id": "demo-student",
        "email": "student@saath.local",
        "password": "Student@123",
        "name": "Riya Kumari",
        "role": "student",
        "district_id": "gaya",
    },
    "parent": {
        "id": "demo-parent",
        "email": "parent@saath.local",
        "password": "Parent@123",
        "name": "Sunita Devi",
        "relation": "mother",
        "role": "parent",
        "district_id": "gaya",
    },
    "counsellor": {
        "id": "demo-counsellor",
        "email": "counsellor@saath.local",
        "password": "Counsellor@123",
        "name": "Anjali Verma",
        "role": "counsellor",
        "district_id": "patna",
    },
    "teacher": {
        "id": "demo-teacher",
        "email": "teacher@saath.local",
        "password": "Teacher@123",
        "name": "Rakesh Kumar",
        "role": "teacher",
        "district_id": "gaya",
    },
    "admin": {
        "id": "demo-admin",
        "email": "admin@saath.local",
        "password": "Admin@123",
        "name": "District Skill Officer",
        "role": "admin",
        "district_id": None,
    },
}


def migrate():
    print(f"Connecting to MongoDB at {config.MONGO_URI} (Database: {config.MONGO_DB_NAME})...")
    sync_db = mongo.get_sync_db()
    mongo.init_sync_indexes()

    users_col = sync_db["users"]

    # 1. Ensure core demo/staff accounts are created with Argon2id passwords
    print("\nEnsuring demo accounts exist in MongoDB:")
    for role, info in DEMO_ACCOUNTS.items():
        norm_email = security.normalize_email(info["email"])
        now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
        doc = {
            "_id": info["id"],
            "name": info["name"],
            "email": info["email"],
            "normalized_email": norm_email,
            "password_hash": security.hash_password(info["password"]),
            "role": info["role"],
            "relation": info.get("relation"),
            "preferred_lang": "hi",
            "district_id": info.get("district_id"),
            "is_email_verified": True,
            "is_active": True,
            "created_at": now_iso,
            "updated_at": now_iso,
            "last_login_at": None,
        }
        users_col.update_one({"_id": info["id"]}, {"$set": doc}, upsert=True)
        print(f"  [OK] {role.capitalize()}: {info['email']} / {info['password']}")

    # 2. If SQLite file exists, migrate remaining users and profiles
    if not SQLITE_DB.exists():
        print(f"\nSQLite database {SQLITE_DB} not found. Skipping SQLite record extraction.")
        return

    print(f"\nReading SQLite database from {SQLITE_DB}...")
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Migrate users
    rows = cur.execute("SELECT * FROM users").fetchall()
    migrated_users = 0
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    default_pwd_hash = security.hash_password("Saath@2026")

    for r in rows:
        uid = r["id"]
        if uid in [info["id"] for info in DEMO_ACCOUNTS.values()]:
            continue

        email = f"{uid}@saath.local"
        norm_email = security.normalize_email(email)

        doc = {
            "_id": uid,
            "name": r["name"] or "",
            "email": email,
            "normalized_email": norm_email,
            "password_hash": default_pwd_hash,
            "role": r["role"] or "student",
            "relation": r["relation"],
            "preferred_lang": r["preferred_lang"] or "hi",
            "district_id": r["district_id"],
            "is_email_verified": True,
            "is_active": True,
            "created_at": r["created_at"] or now_iso,
            "updated_at": now_iso,
            "last_login_at": None,
        }
        users_col.update_one({"_id": uid}, {"$set": doc}, upsert=True)
        migrated_users += 1

    print(f"  [OK] Migrated {migrated_users} user records to MongoDB 'users' collection.")

    # Migrate student_profiles
    profiles_col = sync_db["student_profiles"]
    p_rows = cur.execute("SELECT * FROM student_profiles").fetchall()
    for p in p_rows:
        profiles_col.update_one({"_id": p["id"]}, {"$set": dict(p)}, upsert=True)
    print(f"  [OK] Preserved {len(p_rows)} records in MongoDB 'student_profiles' collection.")

    # Migrate consents
    consents_col = sync_db["consents"]
    c_rows = cur.execute("SELECT * FROM consents").fetchall()
    for c in c_rows:
        consents_col.update_one({"_id": c["user_id"]}, {"$set": dict(c)}, upsert=True)
    print(f"  [OK] Preserved {len(c_rows)} records in MongoDB 'consents' collection.")

    # Migrate career_dna
    dna_col = sync_db["career_dna"]
    d_rows = cur.execute("SELECT * FROM career_dna").fetchall()
    for d in d_rows:
        dna_col.update_one({"_id": d["profile_id"]}, {"$set": dict(d)}, upsert=True)
    print(f"  [OK] Preserved {len(d_rows)} records in MongoDB 'career_dna' collection.")

    conn.close()
    print("\nMigration to MongoDB completed successfully!")


if __name__ == "__main__":
    migrate()
