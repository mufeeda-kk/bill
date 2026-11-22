/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STORE_NAME: string;
  readonly VITE_STORE_TAGLINE: string;
  readonly VITE_STORE_PHONE: string;
  readonly VITE_STORE_ADDRESS: string;
  readonly VITE_STORE_UPI_ID: string;
  readonly VITE_CURRENCY_SYMBOL: string;
  readonly VITE_TIMEZONE: string;
  readonly VITE_ENROLLMENT_PASSCODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
