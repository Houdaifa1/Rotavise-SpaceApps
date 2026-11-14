-- Custom SQL migration file, put your code below! --
-- Rotavise uses Google only to identify a user at sign-in and never calls
-- Google APIs, so OAuth provider tokens are never stored, whatever the auth
-- library passes. Password hashes and scopes are unaffected.
CREATE FUNCTION discard_provider_tokens() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.access_token := NULL;
  NEW.refresh_token := NULL;
  NEW.id_token := NULL;
  NEW.access_token_expires_at := NULL;
  NEW.refresh_token_expires_at := NULL;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER auth_account_no_provider_tokens BEFORE INSERT OR UPDATE ON auth_accounts FOR EACH ROW EXECUTE FUNCTION discard_provider_tokens();--> statement-breakpoint
UPDATE auth_accounts SET access_token = NULL, refresh_token = NULL, id_token = NULL, access_token_expires_at = NULL, refresh_token_expires_at = NULL;
