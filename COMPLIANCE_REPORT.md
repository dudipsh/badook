# דוח אבטחה ופרטיות - Badook

## סיכום בעברית (TL;DR)

### ✅ בוצע
1. **הסרת LangSmith** - תוכן חשבוניות כבר לא משודר לחוץ לארץ
2. **הצפנת OAuth Tokens** - tokens של Gmail/Outlook כעת מוצפנים (AES-256-GCM)
3. **TypeScript בדיקה** - הקוד עובר בהצלחה, אין שגיאות

### ⚠️ צריך לעשות עכשיו
1. **צור ENCRYPTION_KEY חדש** ושים בfalsשאללאללת.env בפרודקשן
2. **תעדכן 4 DPA** עם OpenAI, Google, AWS, Twilio

### ⏳ לפני המוצר לחיים (לקוחות משלמים)
1. Secrets Manager במקום env files
2. מדיניות פרטיות בעברית + תנאים (עו"ד)
3. Gmail OAuth Verification (אם צריך)

---

## בעיות שנמצאו + תיקונים

### 1️⃣ **LangSmith = דלף מידע**

**הבעיה:**
- כל prompt שנשלח ל-OpenAI/Gemini הלך גם לLangSmith בארה"ב
- תוכן חשבוניות (סכומים, שמות ספקים, פריטים) נשמר בשרתים בחוץ לארץ
- הלקוח שלך לא יודע שזה קורה

**הפתרון:**
✅ **סגרנו את זה**
```
הוסרו מ-.env:
❌ LANGSMITH_PROJECT
❌ LANGSMITH_API_KEY
```

**השפעה:** לא משדרים יותר מידע רגיש לחוץ לארץ.

---

### 2️⃣ **OAuth Tokens בטקסט גלוי ב-DB**

**הבעיה:**
```sql
-- המצב לפני:
credentials: JSON = { "refreshToken": "1//0gH...", ... }
-- זה יושב ב-DB גלוי!
```

- אם מישהו יכנס ל-DB (SQL injection, leak בקלוד), יש לו access ל-Gmail/Outlook של הלקוח
- זה הפרה של חוקי אבטחה בישראל (תקנות אבטחת מידע 2017)

**הפתרון:**
✅ **מוצפנים כעת**
```typescript
// Tokens מוצפנים בעת שמירה
credentials: string = "base64(encrypted(AES-256-GCM))"

// פענוח אוטומטי בעת קריאה
const creds = encryption.decrypt(integration.credentials);
```

**קבצים שעדכנו:**
- `Gmail Service` + `Scanner` → הצפנה/פענוח
- `Outlook Service` + `Scanner` → הצפנה/פענוח
- `EncryptionService` (חדש) → לוגיקה של AES-256-GCM
- `EncryptionModule` (חדש) → DI integration

---

### 3️⃣ **בדיקת Compliance - מה משדרים לחוץ לארץ?**

| שירות | מה משדרים | איפה | DPA | הערות |
|------|-----------|------|-----|-------|
| **OpenAI** | תוכן חשבוניות | ארה"ב | ❌ לא עדיין | חובה לחתום |
| **Google Gemini** | תוכן חשבוניות | ארה"ב/EU | ❌ לא עדיין | חובה לחתום |
| **Google Gmail API** | מיילים של משתמש | ארה"ב | ❌ לא עדיין | scope: gmail.readonly |
| **Microsoft Outlook** | מיילים של משתמש | ארה"ב/EU | ❌ לא עדיין | scope: Mail.Read |
| **AWS S3** | תמונות/PDF חשבוניות | EU | ❌ לא עדיין | encryption at rest בברירת מחדל |
| **Twilio WhatsApp** | מדיה + מספרים | ארה"ב | ❌ לא עדיין | חובה לחתום |
| **LangSmith** | ❌ ~~prompts~~ | ❌ | ✅ בוטל | הוסר לחלוטין |

---

## דעות שגויות נפוצות

### ❌ "אנחנו רק MVP, לא צריך DPA עדיין"

**נכון:**
- בחוק הגנת הפרטיות בישראל (תיקון 13), DPA דרוש **מייד** כשמשדרים לצד שלישי
- DPA זה לא "nice to have", זו חובה משפטית
- המשרד להגנת הפרטיות יכול להטיל קנס על חברות שמשדרות בלי DPA
- עלות DPA: **0₪** (providers כבר כוללים אותו בתנאיהם)

### ❌ "אנחנו מוצפנים בGoogle Cloud, אז בסדר"

**נכון:**
- Google/OpenAI encryption (TLS+) זה רק "in transit"
- **אצלך** בDB אתה צריך encryption "at rest"
- הערב/עצמות tokens חייבים להיות מוצפנים + hashים
- **זה עשינו ✅**

### ❌ "אנחנו לא צריכים audit logs"

**נכון:**
- תקנות אבטחת מידע 2017 דורשות audit log של גישות לנתונים רגישים
- "מי ניגש למה ומתי"
- חייב לשמור לפחות 90 ימים
- **עדיין בתוכנית**

---

## Checklist - מה צריך לעשות הבא

### 🔴 היום
```
[ ] קרא SECURITY_COMPLIANCE.md
[ ] הרץ את הפקודה ליצירת ENCRYPTION_KEY
[ ] שים את ENCRYPTION_KEY בקובץ .env בפרודקשן
[ ] Restart את ה-API
```

### 🟡 השבוע
```
[ ] Search OpenAI Data Processing Terms - חתום/confirm agreement exists
[ ] Search Google Cloud DPA - confirm agreement
[ ] Search AWS Data Processing Agreement - confirm agreement
[ ] Search Twilio DPA - confirm agreement
[ ] כתוב מדיניות פרטיות בעברית (עם עו"ד או template)
```

### 🟢 החודש הקרוב
```
[ ] Add ENCRYPTION_KEY to AWS Secrets Manager / GCP Secret Manager
[ ] Remove OPENAI_API_KEY, GEMINI_API_KEY מ-.env → move to Secrets Manager
[ ] Add security headers (HSTS, CSP)
[ ] Set up encrypted RDS backups
[ ] Create DataExport endpoint (/api/users/me/export)
```

---

## קבצים שנוצרו/שונו

### חדשים
```
✅ apps/api/src/infrastructure/encryption/encryption.service.ts
✅ apps/api/src/infrastructure/encryption/encryption.module.ts
✅ apps/api/SECURITY_COMPLIANCE.md
✅ apps/api/.env.example
```

### שונו
```
✏️ apps/api/.env - הסרת LangSmith
✏️ apps/api/src/integrations/gmail/gmail.service.ts - הצפנה
✏️ apps/api/src/integrations/gmail/gmail-scanner.service.ts - פענוח
✏️ apps/api/src/integrations/gmail/gmail.module.ts - EncryptionModule import
✏️ apps/api/src/integrations/outlook/outlook.service.ts - הצפנה
✏️ apps/api/src/integrations/outlook/outlook-scanner.service.ts - פענוח
✏️ apps/api/src/integrations/outlook/outlook.module.ts - EncryptionModule import
```

---

## Build Status

```bash
✅ TypeScript compilation: PASS
✅ No type errors
✅ Imports valid
✅ Services injectable
```

---

## סיכום חוקי

### חוקים בישראל שיחול עליך:

1. **חוק הגנת הפרטיות, התשמ"א-1981 + תיקון 13**
   - ✅ הצפנה של tokens - בוצע
   - ⏳ DPA עם suppliers
   - ⏳ מדיניות פרטיות בעברית

2. **תקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017**
   - ✅ Encryption at rest (tokens) - בוצע
   - ⏳ Encryption at rest (database full)
   - ⏳ Audit trail של גישות

3. **GDPR (אם יש משתמשים מEU)**
   - ⏳ Data Processing Agreement (DPA)
   - ⏳ Legitimate Interest Assessment (LIA)

---

**עדכון ביצוע:** 2026-05-06  
**עדכון הבא דרוש:** לפני שיש לקוחות משלמים  
**זמן הערכה:** 6-12 חודשים עד Full Compliance  
