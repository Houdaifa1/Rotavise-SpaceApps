import type { Pool } from "pg";
export async function authReady(pool: Pool) {
  await pool.query(
    "SELECT u.email_verified,s.token,a.password,v.identifier,l.last_request,m.ciphertext FROM auth_users u LEFT JOIN auth_sessions s ON s.user_id=u.id LEFT JOIN auth_accounts a ON a.user_id=u.id LEFT JOIN auth_verifications v ON false LEFT JOIN auth_rate_limits l ON false LEFT JOIN auth_mail m ON m.user_id=u.id LIMIT 0",
  );
  await pool.query(
    "SELECT f.profile,h.entry FROM fields f LEFT JOIN field_crop_history h ON h.field_id=f.id LIMIT 0",
  );
}
