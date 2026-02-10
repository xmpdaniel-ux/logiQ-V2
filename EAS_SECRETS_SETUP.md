# EAS Secrets Configuration Guide

## Keystore Upload to EAS

To configure remote credentials and eliminate the "File not found" error, follow these steps:

### Step 1: Upload Keystore to EAS
```bash
cd c:\logiQ\logiQ-V2
npx eas credentials
```

When prompted:
1. Select **Android**
2. Select **Production**
3. Choose **Keystore: Manage everything needed to build your project**
4. Select **Set up a new keystore**
5. When asked for the keystore file, provide: `c:\logiQ\frontend\@mrdeath2__logiq.bak.jks`
6. Enter the credentials from `credentials.json`:
   - **Keystore Password**: `c5c488bdc65e1ef678c6b2e151a18814`
   - **Key Alias**: `1e3c1503657547b84d10073c51f4145c`
   - **Key Password**: `82c42a94a01830174eee2b3b86004ec1`

### Step 2: Verify Remote Credentials
```bash
npx eas credentials
```

Navigate to Android > Production > Keystore and verify the status shows:
- ✅ **Keystore**: Configured (Remote)
- ✅ **Key Alias**: Configured
- ✅ **Passwords**: Stored securely

### Step 3: Remove Local Credentials File
Once remote credentials are confirmed:
```bash
rm c:\logiQ\logiQ-V2\credentials.json
```

### Step 4: Verify Configuration
The updated `eas.json` no longer has `credentialsSource: "local"`. EAS will automatically use the remote credentials stored in EAS Secrets.

## Next Steps
After confirming the Keystore status is "Remote/Secret":
1. Run `npx expo prebuild --clean`
2. Launch Build 03-V2
3. Monitor the build for success

## Troubleshooting
If the credentials upload fails:
- Ensure the keystore file path is correct
- Verify the passwords match exactly
- Check that you have proper EAS account permissions
