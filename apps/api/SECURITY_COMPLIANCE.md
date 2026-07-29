# אבטחה ופרטיות - תוכנית יישום

## עדכונים שבוצעו

### ✅ 1. הסרת LangSmith
- **עדכון .env**: הוסרו `LANGSMITH_PROJECT` ו-`LANGSMITH_API_KEY`
- **תוצאה**: תוכן החשבוניות לא משודר עוד לשרתי LangSmith בארה"ב
- **חובה משפטית**: עמידה בחוק הגנת הפרטיות בישראל (תיקון 13)

### ✅ 2. הצפנת OAuth Tokens
**בעיה שנפתרה**: OAuth tokens (refresh tokens) של Gmail ו-Outlook נשמרו בטקסט גלוי בDB.

**פתרון יושם**:
- יצירת `EncryptionService` (AES-256-GCM)
- הצפנה של tokens בעת שמירה
- פענוח של tokens בעת קריאה
- עדכון Gmail, Outlook וscannersהם

**חובה משפטית**: תקנות אבטחת מידע 2017 - הצפנה במנוחה של מידע רגיש

---

## שלבים להשלמה (לפרודקשן)

### 🔴 קריטי - צריך לעשות עכשיו

#### 1. הגדרת ENCRYPTION_KEY

```bash
# הגנרט מפתח הצפנה (64 hex characters / 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# דוגמה של output:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f
```

**הוסף ל-.env בפרודקשן:**
```
ENCRYPTION_KEY="[פלט מהפקודה למעלה]"
```

**⚠️ חשוב**: 
- האחסון ב-AWS Secrets Manager או GCP Secret Manager, לא ברחמי קבצי הטקסט
- אל תעשה commit של ENCRYPTION_KEY לגit
- אם המפתח נחשף - ייתכן ש-tokens ישנים יהיו קריאים

---

### 🟡 חובה רגולטורית - לעשות לפני שיש לקוחות משלמים

#### 2. Migration של Credentials קיימים
אם יש לך כבר credentials שמור ישנים בDB בטקסט גלוי, תצריך migration:

```sql
-- הערה: זה דורש עבודה בקוד מכיוון שה-decryption צריך להיות ידני
-- בשביל עכשיו, אם אין production data - אתה בסדר
```

**הוראות אם יש legacy data:**
1. Export credentials ישנים מה-DB
2. הרץ migration script להצפנה
3. Re-import לـ DB
4. ודא שהקריאה עדיין עובדת

---

#### 3. בדיקת Encryption אצל כל Provider

| Provider | נתון שנשמר | הצפנה | DPA דרוש |
|----------|-----------|-------|----------|
| **Gmail OAuth** | refresh_token | ✅ כן (service) | בעבודה |
| **Outlook OAuth** | refresh_token + access_token | ✅ כן (service) | בעבודה |
| **OpenAI API key** | בenv file | ❌ לא (Secrets Manager) | בעבודה |
| **Google Gemini API key** | בenv file | ❌ לא (Secrets Manager) | בעבודה |
| **AWS S3 credentials** | בenv file | ❌ לא (Secrets Manager) | בעבודה |

---

#### 4. DPA (Data Processing Agreements) - חובה משפטית

צריך לחתום/לעדכן DPA עם:
- ✅ **OpenAI** - שליחת תוכן חשבוניות לעיבוד
- ✅ **Google Cloud** (Gemini + Vertex AI) - שליחת תוכן חשבוניות
- ✅ **Google APIs** (Gmail) - קריאת מיילים
- ✅ **Microsoft Graph** (Outlook) - קריאת מיילים
- ✅ **AWS** (S3) - אחסון קבצים
- ✅ **Twilio** (WhatsApp) - שליחה של הודעות + media
- ✅ **Modal** (Badook AI) - עיבוד תמונות חשבוניות

**איפה למצוא:**
- OpenAI: https://openai.com/enterprise/data-processing-agreement
- Google Cloud: https://cloud.google.com/terms/data-processing-terms
- AWS: https://aws.amazon.com/artifacts/ (דורש login)
- Twilio: https://www.twilio.com/legal
- Microsoft: https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum

---

### 🟢 חשוב אבל לא חוסם את ההשקה

#### 5. אבטחה נוספת שצריכה בדיקה

```
[ ] HTTPS בכל המערכת (בפרודקשן)
[ ] Security headers (HSTS, CSP, X-Frame-Options)
[ ] CORS מוגבל לדומיינים מאושרים בלבד
[ ] Rate limiting על login/auth endpoints
[ ] Log rotation + ניתור לוגים לפורמט בטוח (לא sensitive data)
[ ] Backup encryption (RDS + S3)
[ ] MFA לחשבונות관리
```

---

#### 6. מדיניות פרטיות + תנאים - חובה משפטית

צריך לכתוב (עם עו"ד פרטיות):

```
[ ] מדיניות פרטיות בעברית
    - איזה מידע אנחנו אוספים
    - למה
    - למי משדרים
    - כמה זמן שומרים
    
[ ] תנאי שימוש
    - זכויות ודברות החברה שלנו
    - אחריות
    
[ ] הודעה על קבלת קבצים עם PII
    - שדה "I acknowledge I understand..."
```

---

#### 7. Audit Trail - תיעוד גישה

⏳ **בתוכנית להמשך**: צריך להוסיף audit log כללי לקריאת מידע רגיש:

```typescript
// כל גישה למידע פיננסי צריכה להתעדן:
{
  userId: "...",
  action: "read_invoice",
  documentId: "...",
  companyId: "...",
  timestamp: "...",
  ipAddress: "..."
}
```

---

## תוכנית הממשך (Priority Order)

```
שלב 0 (היום):
  ✅ הסרה של LangSmith
  ✅ הצפנת OAuth tokens
  ☐ הגדרת ENCRYPTION_KEY בפרודקשן

שלב 1 (השבוע - לפני שום לקוח):
  ☐ כתיבת מדיניות פרטיות + תנאים (עו"ד)
  ☐ setup Secrets Manager (AWS/GCP)
  ☐ Security headers + CORS
  ☐ DPA עם OpenAI, Google, AWS

שלב 2 (חודש - לפני 10 לקוחות):
  ☐ Audit trail על קריאות מידע
  ☐ Data retention + soft delete
  ☐ DSR endpoints (export/delete משתמש)
  ☐ Encrypted backups

שלב 3 (3 חודשים):
  ☐ Gmail OAuth Verification + CASA (אם צריך)
  ☐ Penetration testing
  ☐ סקר סיכונים רשמי (עם יועץ בטחון)
```

---

## טוען וטעויות נפוצות

### ❌ "יוקח לנו חודשים..."
**תשובה:** 
- Encryption tokens: ✅ כבר עשינו
- DPA: ⏱️ שעתיים לכתיבה (עם עו"ד)
- Audit log: ⏱️ יומיים
- Backup encryption: ✅ רוב ה-SaaS providers שומרים מוצפנים

### ❌ "אנחנו רק MVP, למה חשוב?"
**תשובה:**
- אם תקבל לקוח אחד ואחר כך תצטרך לשנות - עלות migrationה = גדולה יותר
- חוקים בישראל כבר בתוקף (תיקון 13 מאוגוסט 2025)
- דיוק מוקדם = מקצועיות

### ❌ "האם צריך DPA?"
**תשובה:**
- **כן**, אם אתה משדר נתונים לכל supplier (AWS, OpenAI, וכו')
- DPA זה לא optional, זו חוק (GDPR בEU, תקנות אבטחת מידע בישראל)

---

## קישורים שימושיים

- [תיקון 13 לחוק הגנת הפרטיות](https://www.gov.il/)
- [תקנות אבטחת מידע 2017](https://www.justice.gov.il/)
- [אתר הרשות להגנת הפרטיות](https://www.gov.il/he/departments/privacy)

---

**עדכון ביצוע:** 2026-05-06
