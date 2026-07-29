import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export const CHAT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'list_projects',
    description:
      'מחזיר רשימה של הפרויקטים בחברה של המשתמש כולל מספר תעודות משלוח/הזמנות רכש/חשבוניות. השתמש כשהמשתמש שואל "אילו פרויקטים יש לי?" או רוצה לראות סקירה של פרויקטים.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        includeArchived: {
          type: SchemaType.BOOLEAN,
          description: 'האם לכלול פרויקטים בארכיון. ברירת מחדל: false.',
        },
        search: {
          type: SchemaType.STRING,
          description: 'חיפוש חלקי בשם הפרויקט (case-insensitive).',
        },
      },
    },
  },
  {
    name: 'get_project_summary',
    description:
      'מחזיר פירוט מלא לפרויקט יחיד: סכומי חשבוניות, סכומי הזמנות רכש, יחס התאמה (match rate), ומספר חריגות.',
    parameters: {
      type: SchemaType.OBJECT,
      required: ['projectId'],
      properties: {
        projectId: {
          type: SchemaType.STRING,
          description: 'מזהה הפרויקט. השג אותו קודם דרך list_projects.',
        },
      },
    },
  },
  {
    name: 'list_suppliers',
    description:
      'מחזיר רשימת ספקים בחברה. אפשר לסנן לפי טקסט חיפוש או לפי פרויקט. השתמש כשהמשתמש שואל על ספקים, "מי הספקים שלי" וכו\'.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: {
          type: SchemaType.STRING,
          description: 'חיפוש חלקי בשם הספק.',
        },
        projectId: {
          type: SchemaType.STRING,
          description: 'הצג רק ספקים שעבדו עם פרויקט מסוים.',
        },
      },
    },
  },
  {
    name: 'list_discrepancies',
    description:
      'מחזיר רשימת חריגות/חוסרים: התאמות 3-way שלא הושלמו (PARTIAL/DISCREPANCY/UNMATCHED). השתמש כשהמשתמש שואל "איפה יש חוסרים?", "אילו בעיות יש?", "מה לא התאים?".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        projectId: {
          type: SchemaType.STRING,
          description: 'סנן לפי פרויקט.',
        },
        supplierId: {
          type: SchemaType.STRING,
          description: 'סנן לפי ספק.',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'מספר תוצאות מקסימלי (1-50). ברירת מחדל: 20.',
        },
      },
    },
  },
  {
    name: 'get_company_overview',
    description:
      'מחזיר סטטיסטיקה מצרפית של החברה: מספר פרויקטים, ספקים, מסמכים, ויחס התאמה כללי. שימושי לשאלות פתיחה כמו "מה המצב?", "תן לי סקירה".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'find_supplied_items',
    description:
      'מאתר אילו מוצרים קיימים בשורות המסמכים, מאוחדים לפי מק"ט — כך שאותו מוצר שמופיע אצל ספקים שונים בשמות שונים (aliases) נספר כפריט אחד, ומוחזרת רשימת ה-aliases שלו בשדה aliases. השתמש לפני aggregate_item_supply כשאינך בטוח בניסוח המדויק, או אם aggregate_item_supply החזיר 0 תוצאות. כשהמשתמש שואל "אילו סוגים יש לי" — הסתמך על מספר הפריטים המאוחד הזה ואל תספור aliases של אותו מוצר כסוגים נפרדים.',
    parameters: {
      type: SchemaType.OBJECT,
      required: ['itemQuery'],
      properties: {
        itemQuery: {
          type: SchemaType.STRING,
          description: 'מילות מפתח מתיאור הפריט, למשל "מלט שחור".',
        },
        docType: {
          type: SchemaType.STRING,
          description: 'delivery_note (ברירת מחדל) | invoice | purchase_order',
        },
      },
    },
  },
  {
    name: 'aggregate_item_supply',
    description:
      'סוכם כמויות ומחירים של פריט מסוים על פני מסמכים. עונה על: "כמה שקי מלט שחור 25 קילו סופקו בכל הפרויקטים?", "כמה סופקו בפרויקט X בין ינואר למאי 2026?", "כמה סיפק ספק Y ובאיזה מחיר ממוצע?". ברירת המחדל היא תעודות משלוח (אספקה בפועל); למחירים השתמש גם ב-docType=invoice. לפילוח (לפי פרויקט/ספק/חודש) העבר groupBy.',
    parameters: {
      type: SchemaType.OBJECT,
      required: ['itemQuery'],
      properties: {
        itemQuery: {
          type: SchemaType.STRING,
          description:
            'תיאור הפריט, למשל: מלט שחור 25 ק"ג. ההתאמה מאחדת aliases של אותו מוצר ומתרככת אוטומטית אם אין התאמה מדויקת (מספיק שרוב המילים יופיעו), כך שאין צורך בניסוח מדויק. אל תכלול מילות יחידה כמו "שקי".',
        },
        docType: {
          type: SchemaType.STRING,
          description:
            'delivery_note (ברירת מחדל, כמה סופק) | invoice (כמה חויב + מחירים) | purchase_order (כמה הוזמן)',
        },
        groupBy: {
          type: SchemaType.STRING,
          description: 'פילוח תוצאות: project | supplier | month | none (ברירת מחדל)',
        },
        projectId: { type: SchemaType.STRING, description: 'מזהה פרויקט (מ-list_projects).' },
        projectName: { type: SchemaType.STRING, description: 'לחלופין: שם פרויקט (חיפוש חלקי).' },
        supplierId: { type: SchemaType.STRING, description: 'מזהה ספק (מ-list_suppliers).' },
        supplierName: { type: SchemaType.STRING, description: 'לחלופין: שם ספק (חיפוש חלקי).' },
        dateFrom: { type: SchemaType.STRING, description: 'מתאריך YYYY-MM-DD (לפי תאריך המסמך).' },
        dateTo: { type: SchemaType.STRING, description: 'עד תאריך YYYY-MM-DD.' },
      },
    },
  },
  {
    name: 'list_item_documents',
    description:
      'מחזיר את רשימת המסמכים בפועל (תעודות משלוח/חשבוניות/הזמנות רכש) שמכילים פריט מסוים — כל מסמך עם הכמות, המחיר והסכום של אותו פריט. השתמש כשהמשתמש שואל "באיזה הזמנה/חשבונית יש לי את הפריט?", "הצג לי את ההזמנות עם מלט שחור", "מאילו מסמכים סופק X". בניגוד ל-aggregate_item_supply שמסכם מספרים — כאן מציגים את המסמכים עצמם כדי שאפשר יהיה לפתוח אותם. ברירת מחדל: תעודות משלוח; לחשבוניות העבר docType=invoice, להזמנות רכש docType=purchase_order.',
    parameters: {
      type: SchemaType.OBJECT,
      required: ['itemQuery'],
      properties: {
        itemQuery: {
          type: SchemaType.STRING,
          description:
            'תיאור הפריט, למשל: מלט שחור 25 ק"ג. ההתאמה מאחדת aliases של אותו מוצר ומתרככת אוטומטית אם אין התאמה מדויקת (מספיק שרוב המילים יופיעו), כך שאין צורך בניסוח מדויק. אל תכלול מילות יחידה כמו "שקי".',
        },
        docType: {
          type: SchemaType.STRING,
          description: 'delivery_note (ברירת מחדל) | invoice | purchase_order',
        },
        projectId: { type: SchemaType.STRING, description: 'מזהה פרויקט (מ-list_projects).' },
        projectName: { type: SchemaType.STRING, description: 'לחלופין: שם פרויקט (חיפוש חלקי).' },
        supplierId: { type: SchemaType.STRING, description: 'מזהה ספק (מ-list_suppliers).' },
        supplierName: { type: SchemaType.STRING, description: 'לחלופין: שם ספק (חיפוש חלקי).' },
        dateFrom: { type: SchemaType.STRING, description: 'מתאריך YYYY-MM-DD (לפי תאריך המסמך).' },
        dateTo: { type: SchemaType.STRING, description: 'עד תאריך YYYY-MM-DD.' },
      },
    },
  },
];
