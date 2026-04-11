Place Firebase Android config files here for flavor builds:

1. `android/app/src/user/google-services.json`
   - Firebase app package: `com.feely.mobile.user`

2. `android/app/src/host/google-services.json`
   - Firebase app package: `com.feely.mobile.host`

Alternative:
- Use one file at `android/app/src/main/google-services.json` only if both flavors map to one Firebase app package (not recommended).

Notes:
- Add SHA-1 and SHA-256 for release signing key in Firebase Console for both apps.
- Do not commit real `google-services.json` to public repositories unless your security policy allows it.
