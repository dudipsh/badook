/**
 * Curated construction products database for training data generation.
 *
 * These are REAL materials that appear on Israeli construction delivery notes,
 * invoices, and purchase orders — not retail consumer products.
 *
 * Categories mirror the actual construction industry:
 *   - בטון ומלט (Concrete & Cement)
 *   - ברזל ופלדה (Steel & Rebar)
 *   - בלוקים ולבנים (Blocks & Bricks)
 *   - איטום ובידוד (Waterproofing & Insulation)
 *   - אינסטלציה (Plumbing)
 *   - חשמל (Electrical)
 *   - עץ ונגרות (Wood & Carpentry)
 *   - ריצוף וחיפוי (Tiling & Flooring)
 *   - צבעים וחומרי גמר (Paints & Finishes)
 *   - חומרי בנייה כלליים (General Building Materials)
 *   - ברגים ומחברים (Fasteners & Hardware)
 *   - כלי עבודה (Tools)
 *   - בטיחות (Safety Equipment)
 *   - גבס ותקרות (Gypsum & Ceilings)
 *
 * Output: output/construction-products.json
 */

interface ConstructionProduct {
  name: string;
  category: string;
  unit: string;
  priceRange: [number, number]; // min, max realistic price
  variants?: string[]; // common size/type variants
  commonVendors?: string[]; // known Israeli vendors
}

// ============================================================
// CONCRETE & CEMENT — בטון ומלט
// ============================================================
const CONCRETE_CEMENT: ConstructionProduct[] = [
  { name: 'בטון מובא B-30', category: 'בטון ומלט', unit: 'מ"ק', priceRange: [380, 520], variants: ['B-20', 'B-25', 'B-30', 'B-40', 'B-50'], commonVendors: ['רדימיקס', 'המנור', 'בטון דרום'] },
  { name: 'בטון שליש', category: 'בטון ומלט', unit: 'מ"ק', priceRange: [300, 420] },
  { name: 'בטון זחיח', category: 'בטון ומלט', unit: 'מ"ק', priceRange: [420, 580] },
  { name: 'מלט פורטלנד CEM I 52.5', category: 'בטון ומלט', unit: 'טון', priceRange: [450, 650], variants: ['CEM I 42.5', 'CEM I 52.5', 'CEM II 42.5'], commonVendors: ['נשר', 'מפעלי מלט'] },
  { name: 'מלט שק 25 ק"ג', category: 'בטון ומלט', unit: 'שק', priceRange: [18, 32], variants: ['25 ק"ג', '50 ק"ג'] },
  { name: 'מלט לבן', category: 'בטון ומלט', unit: 'שק', priceRange: [35, 55] },
  { name: 'בטון יבש', category: 'בטון ומלט', unit: 'שק', priceRange: [15, 28] },
  { name: 'מוריט 3000', category: 'בטון ומלט', unit: 'שק', priceRange: [22, 38], variants: ['מוריט 1000', 'מוריט 3000', 'מוריט 5000'] },
  { name: 'גראוט', category: 'בטון ומלט', unit: 'שק', priceRange: [25, 45], variants: ['גראוט רגיל', 'גראוט מתנפח'] },
  { name: 'טיט', category: 'בטון ומלט', unit: 'שק', priceRange: [12, 22] },
  { name: 'חול בניין', category: 'בטון ומלט', unit: 'טון', priceRange: [60, 120] },
  { name: 'חצץ', category: 'בטון ומלט', unit: 'טון', priceRange: [70, 130], variants: ['חצץ 19/25', 'חצץ 9/19', 'חצץ 4/9'] },
  { name: 'אגרגט בזלת', category: 'בטון ומלט', unit: 'טון', priceRange: [80, 150] },
  { name: 'תוסף בטון מאיץ', category: 'בטון ומלט', unit: 'ליטר', priceRange: [8, 18] },
  { name: 'תוסף בטון מאט', category: 'בטון ומלט', unit: 'ליטר', priceRange: [8, 18] },
  { name: 'סיב פוליפרופילן לבטון', category: 'בטון ומלט', unit: 'ק"ג', priceRange: [35, 65] },
  { name: 'מיקרו סיליקה', category: 'בטון ומלט', unit: 'שק', priceRange: [30, 55] },
  { name: 'טיח מכני', category: 'בטון ומלט', unit: 'שק', priceRange: [18, 35], commonVendors: ['טמבור', 'סיכה'] },
  { name: 'טיח גס', category: 'בטון ומלט', unit: 'שק', priceRange: [14, 25] },
  { name: 'טיח שליכט', category: 'בטון ומלט', unit: 'שק', priceRange: [22, 40] },
  { name: 'שפכטל', category: 'בטון ומלט', unit: 'שק', priceRange: [20, 38] },
  { name: 'דבק אריחים', category: 'בטון ומלט', unit: 'שק', priceRange: [28, 55], variants: ['C1', 'C2', 'C2TE'], commonVendors: ['פלקס', 'טמבור', 'סיכה'] },
  { name: 'רובה לאריחים', category: 'בטון ומלט', unit: 'שק', priceRange: [20, 45] },
  { name: 'פסטה לתיקון בטון', category: 'בטון ומלט', unit: 'ק"ג', priceRange: [15, 35] },
];

// ============================================================
// STEEL & REBAR — ברזל ופלדה
// ============================================================
const STEEL_REBAR: ConstructionProduct[] = [
  { name: 'ברזל זיון Ø8', category: 'ברזל ופלדה', unit: 'טון', priceRange: [3800, 5200], variants: ['Ø6', 'Ø8', 'Ø10', 'Ø12', 'Ø14', 'Ø16', 'Ø20', 'Ø25', 'Ø28', 'Ø32'] },
  { name: 'רשת ברזל Q-196', category: 'ברזל ופלדה', unit: 'יח\'', priceRange: [85, 160], variants: ['Q-131', 'Q-196', 'Q-283', 'Q-393', 'Q-524'] },
  { name: 'פרופיל פלדה IPE 200', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [120, 280], variants: ['IPE 100', 'IPE 120', 'IPE 140', 'IPE 160', 'IPE 200', 'IPE 240', 'IPE 300'] },
  { name: 'פח מגולוון 0.5 מ"מ', category: 'ברזל ופלדה', unit: 'מ"ר', priceRange: [25, 55], variants: ['0.4 מ"מ', '0.5 מ"מ', '0.6 מ"מ', '0.8 מ"מ', '1.0 מ"מ'] },
  { name: 'פלטת פלדה 10 מ"מ', category: 'ברזל ופלדה', unit: 'ק"ג', priceRange: [5, 9] },
  { name: 'צינור פלדה שחור 2"', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [35, 75], variants: ['1/2"', '3/4"', '1"', '1.5"', '2"', '3"', '4"'] },
  { name: 'כבל פלדה 6 מ"מ', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [8, 18] },
  { name: 'עוגן מתכת M12', category: 'ברזל ופלדה', unit: 'יח\'', priceRange: [8, 22], variants: ['M8', 'M10', 'M12', 'M16', 'M20'] },
  { name: 'חישוק ברזל', category: 'ברזל ופלדה', unit: 'ק"ג', priceRange: [4, 8] },
  { name: 'אומגה פלדה', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [15, 35] },
  { name: 'פלדה מיתרית Y1860', category: 'ברזל ופלדה', unit: 'טון', priceRange: [6000, 9000] },
  { name: 'סורג ברזל', category: 'ברזל ופלדה', unit: 'מ"ר', priceRange: [80, 180] },
  { name: 'קורת פלדה HEA 200', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [180, 350], variants: ['HEA 100', 'HEA 160', 'HEA 200', 'HEA 240', 'HEA 300'] },
  { name: 'זוית פלדה 50×50×5', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [20, 45] },
  { name: 'ברזל שטוח 40×5', category: 'ברזל ופלדה', unit: 'מ"א', priceRange: [12, 28] },
];

// ============================================================
// BLOCKS & BRICKS — בלוקים ולבנים
// ============================================================
const BLOCKS_BRICKS: ConstructionProduct[] = [
  { name: 'בלוק בטון 20', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [3.5, 7], variants: ['בלוק 10', 'בלוק 15', 'בלוק 20', 'בלוק 25'], commonVendors: ['איטונג', 'בלוקאן'] },
  { name: 'בלוק איטונג 20', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [8, 16], variants: ['10 ס"מ', '15 ס"מ', '20 ס"מ', '25 ס"מ'], commonVendors: ['איטונג'] },
  { name: 'לבנה חרס', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [2, 5] },
  { name: 'בלוק ספליט', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [6, 14] },
  { name: 'בלוק תרמי', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [12, 22] },
  { name: 'בלוק אקוסטי', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [10, 20] },
  { name: 'משטח בלוקים', category: 'בלוקים ולבנים', unit: 'משטח', priceRange: [350, 700] },
  { name: 'בלוק עמוד 20', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [5, 10] },
  { name: 'בלוק U', category: 'בלוקים ולבנים', unit: 'יח\'', priceRange: [6, 12] },
  { name: 'אבן שפה', category: 'בלוקים ולבנים', unit: 'מ"א', priceRange: [20, 45] },
  { name: 'משתלבות לריצוף', category: 'בלוקים ולבנים', unit: 'מ"ר', priceRange: [50, 120] },
  { name: 'אבן גיר', category: 'בלוקים ולבנים', unit: 'מ"ר', priceRange: [80, 200] },
];

// ============================================================
// WATERPROOFING & INSULATION — איטום ובידוד
// ============================================================
const WATERPROOFING_INSULATION: ConstructionProduct[] = [
  { name: 'יריעת ביטומן', category: 'איטום ובידוד', unit: 'גליל', priceRange: [120, 280], variants: ['3 מ"מ', '4 מ"מ', '5 מ"מ'], commonVendors: ['פזנר', 'איזומיט', 'סיקה'] },
  { name: 'פריימר ביטומני', category: 'איטום ובידוד', unit: 'פח', priceRange: [45, 95] },
  { name: 'איטום ביטומני שחור', category: 'איטום ובידוד', unit: 'פח', priceRange: [55, 120] },
  { name: 'סיקה פלקס', category: 'איטום ובידוד', unit: 'ק"ג', priceRange: [25, 55], commonVendors: ['סיקה'] },
  { name: 'איטום אלסטומרי', category: 'איטום ובידוד', unit: 'ק"ג', priceRange: [30, 65] },
  { name: 'איטום פוליאוריטן', category: 'איטום ובידוד', unit: 'ק"ג', priceRange: [45, 85] },
  { name: 'קרם איטום חד-רכיבי', category: 'איטום ובידוד', unit: 'ק"ג', priceRange: [35, 70] },
  { name: 'פוליסטירן מוקצף EPS', category: 'איטום ובידוד', unit: 'מ"ר', priceRange: [15, 45], variants: ['3 ס"מ', '5 ס"מ', '8 ס"מ', '10 ס"מ'] },
  { name: 'פוליסטירן שחול XPS', category: 'איטום ובידוד', unit: 'מ"ר', priceRange: [25, 65], variants: ['3 ס"מ', '5 ס"מ', '8 ס"מ', '10 ס"מ'] },
  { name: 'צמר סלעים', category: 'איטום ובידוד', unit: 'מ"ר', priceRange: [20, 55], variants: ['5 ס"מ', '8 ס"מ', '10 ס"מ', '15 ס"מ'] },
  { name: 'צמר זכוכית', category: 'איטום ובידוד', unit: 'גליל', priceRange: [80, 180] },
  { name: 'לוח פוליאיזו PIR', category: 'איטום ובידוד', unit: 'מ"ר', priceRange: [35, 85] },
  { name: 'ממברנה HDPE', category: 'איטום ובידוד', unit: 'מ"ר', priceRange: [8, 22] },
  { name: 'סרט איטום בוטיל', category: 'איטום ובידוד', unit: 'גליל', priceRange: [35, 75] },
  { name: 'חומר מילוי פוליאוריתן', category: 'איטום ובידוד', unit: 'שפופרת', priceRange: [18, 38] },
  { name: 'סיליקון תעשייתי', category: 'איטום ובידוד', unit: 'שפופרת', priceRange: [15, 35] },
  { name: 'טייבק עוטף בניין', category: 'איטום ובידוד', unit: 'גליל', priceRange: [250, 500] },
  { name: 'ניילון בנייה 0.2 מ"מ', category: 'איטום ובידוד', unit: 'גליל', priceRange: [60, 140] },
  { name: 'דביט', category: 'איטום ובידוד', unit: 'פח', priceRange: [80, 160] },
];

// ============================================================
// PLUMBING — אינסטלציה
// ============================================================
const PLUMBING: ConstructionProduct[] = [
  { name: 'צינור PVC 110 ביוב', category: 'אינסטלציה', unit: 'מ"א', priceRange: [18, 42], variants: ['50 מ"מ', '75 מ"מ', '110 מ"מ', '160 מ"מ', '200 מ"מ'] },
  { name: 'צינור PPR 25 מ"מ', category: 'אינסטלציה', unit: 'מ"א', priceRange: [6, 15], variants: ['20 מ"מ', '25 מ"מ', '32 מ"מ', '40 מ"מ', '50 מ"מ', '63 מ"מ'] },
  { name: 'צינור פלקסגול 20 מ"מ', category: 'אינסטלציה', unit: 'מ"א', priceRange: [8, 18] },
  { name: 'צינור נחושת 22 מ"מ', category: 'אינסטלציה', unit: 'מ"א', priceRange: [25, 55] },
  { name: 'ברז כדורי 1/2"', category: 'אינסטלציה', unit: 'יח\'', priceRange: [15, 45], variants: ['1/2"', '3/4"', '1"', '1.5"', '2"'] },
  { name: 'שסתום חד-כיווני', category: 'אינסטלציה', unit: 'יח\'', priceRange: [20, 65] },
  { name: 'מפצל PPR', category: 'אינסטלציה', unit: 'יח\'', priceRange: [5, 15] },
  { name: 'ברכיה PPR 25×90°', category: 'אינסטלציה', unit: 'יח\'', priceRange: [3, 10] },
  { name: 'חיבור הולנדי 1"', category: 'אינסטלציה', unit: 'יח\'', priceRange: [12, 30] },
  { name: 'ניפל מגולוון 3/4"', category: 'אינסטלציה', unit: 'יח\'', priceRange: [5, 15] },
  { name: 'שוחת ביקורת', category: 'אינסטלציה', unit: 'יח\'', priceRange: [150, 400] },
  { name: 'מכסה שוחה ברזל יציקה', category: 'אינסטלציה', unit: 'יח\'', priceRange: [200, 550] },
  { name: 'דוד שמש 150 ליטר', category: 'אינסטלציה', unit: 'יח\'', priceRange: [1500, 3500], variants: ['120 ליטר', '150 ליטר', '200 ליטר'] },
  { name: 'צינור גמיש לגז', category: 'אינסטלציה', unit: 'מ"א', priceRange: [25, 55] },
  { name: 'מד מים 3/4"', category: 'אינסטלציה', unit: 'יח\'', priceRange: [80, 180] },
  { name: 'משאבה טבולה', category: 'אינסטלציה', unit: 'יח\'', priceRange: [500, 2000] },
];

// ============================================================
// ELECTRICAL — חשמל
// ============================================================
const ELECTRICAL: ConstructionProduct[] = [
  { name: 'כבל חשמל NYY 3×2.5', category: 'חשמל', unit: 'מ"א', priceRange: [8, 18], variants: ['3×1.5', '3×2.5', '3×4', '3×6', '4×6', '4×10', '4×16', '5×6'] },
  { name: 'כבל NYY 4×10', category: 'חשמל', unit: 'מ"א', priceRange: [25, 50] },
  { name: 'צינור PVC חשמל 25 מ"מ', category: 'חשמל', unit: 'מ"א', priceRange: [3, 8], variants: ['16 מ"מ', '20 מ"מ', '25 מ"מ', '32 מ"מ', '40 מ"מ', '50 מ"מ'] },
  { name: 'קופסת חיבור 10×10', category: 'חשמל', unit: 'יח\'', priceRange: [5, 15] },
  { name: 'לוח חשמל 24 מודולים', category: 'חשמל', unit: 'יח\'', priceRange: [120, 320], variants: ['12 מודולים', '24 מודולים', '36 מודולים', '54 מודולים'] },
  { name: 'מפסק פחת 40A/30mA', category: 'חשמל', unit: 'יח\'', priceRange: [55, 120] },
  { name: 'אוטומט חד-פאזי 16A', category: 'חשמל', unit: 'יח\'', priceRange: [18, 40], variants: ['6A', '10A', '16A', '20A', '25A', '32A'] },
  { name: 'שקע טוקו כפול', category: 'חשמל', unit: 'יח\'', priceRange: [12, 30] },
  { name: 'מפסק תאורה', category: 'חשמל', unit: 'יח\'', priceRange: [10, 28] },
  { name: 'מגש כבלים 200 מ"מ', category: 'חשמל', unit: 'מ"א', priceRange: [35, 80], variants: ['100 מ"מ', '200 מ"מ', '300 מ"מ', '400 מ"מ', '600 מ"מ'] },
  { name: 'פס הארקה', category: 'חשמל', unit: 'מ"א', priceRange: [15, 35] },
  { name: 'חוט נחושת 2.5 מ"ר', category: 'חשמל', unit: 'מ"א', priceRange: [3, 8] },
  { name: 'תאורת חירום', category: 'חשמל', unit: 'יח\'', priceRange: [80, 200] },
  { name: 'שנאי מבדל 5KVA', category: 'חשמל', unit: 'יח\'', priceRange: [1500, 4000] },
  { name: 'גנרטור 5KW', category: 'חשמל', unit: 'יח\'', priceRange: [3000, 8000] },
];

// ============================================================
// WOOD & CARPENTRY — עץ ונגרות
// ============================================================
const WOOD_CARPENTRY: ConstructionProduct[] = [
  { name: 'קורת עץ אורן 5×10', category: 'עץ ונגרות', unit: 'מ"א', priceRange: [25, 55], variants: ['5×5', '5×7.5', '5×10', '5×15', '7.5×10', '10×10'] },
  { name: 'לוח עץ לבוד 18 מ"מ', category: 'עץ ונגרות', unit: 'לוח', priceRange: [80, 180], variants: ['9 מ"מ', '12 מ"מ', '15 מ"מ', '18 מ"מ', '22 מ"מ'] },
  { name: 'דיקט סרט 18 מ"מ', category: 'עץ ונגרות', unit: 'לוח', priceRange: [120, 260], variants: ['9 מ"מ', '12 מ"מ', '15 מ"מ', '18 מ"מ', '21 מ"מ'] },
  { name: 'דיקט ים 18 מ"מ', category: 'עץ ונגרות', unit: 'לוח', priceRange: [180, 350] },
  { name: 'OSB 18 מ"מ', category: 'עץ ונגרות', unit: 'לוח', priceRange: [90, 180] },
  { name: 'MDF 18 מ"מ', category: 'עץ ונגרות', unit: 'לוח', priceRange: [85, 170] },
  { name: 'לוח גבס רגיל 12.5 מ"מ', category: 'עץ ונגרות', unit: 'לוח', priceRange: [25, 50], variants: ['9.5 מ"מ', '12.5 מ"מ', '15 מ"מ'] },
  { name: 'לוח גבס עמיד מים', category: 'עץ ונגרות', unit: 'לוח', priceRange: [35, 65] },
  { name: 'לוח גבס עמיד אש', category: 'עץ ונגרות', unit: 'לוח', priceRange: [40, 70] },
  { name: 'פרופיל C 48', category: 'עץ ונגרות', unit: 'מ"א', priceRange: [8, 18], variants: ['C 48', 'C 70', 'C 100'] },
  { name: 'פרופיל U 48', category: 'עץ ונגרות', unit: 'מ"א', priceRange: [6, 14] },
  { name: 'תליין לתקרה', category: 'עץ ונגרות', unit: 'יח\'', priceRange: [2, 6] },
  { name: 'משטח עץ EUR', category: 'עץ ונגרות', unit: 'יח\'', priceRange: [30, 65] },
  { name: 'קרש גדר 10×200', category: 'עץ ונגרות', unit: 'מ"א', priceRange: [15, 35] },
  { name: 'ציפוי פורמייקה', category: 'עץ ונגרות', unit: 'מ"ר', priceRange: [40, 90] },
];

// ============================================================
// TILING & FLOORING — ריצוף וחיפוי
// ============================================================
const TILING_FLOORING: ConstructionProduct[] = [
  { name: 'אריח פורצלן 60×60', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [45, 120], variants: ['30×30', '45×45', '60×60', '80×80', '100×100', '60×120'] },
  { name: 'אריח קרמיקה 20×20', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [25, 65] },
  { name: 'אריח חיפוי קיר 25×40', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [35, 85] },
  { name: 'גרניט פורצלן חוץ', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [60, 150] },
  { name: 'שיש טבעי', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [150, 450] },
  { name: 'אבן טבעית לחיפוי', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [100, 300] },
  { name: 'פרקט עץ', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [80, 250] },
  { name: 'פרקט למינציה', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [35, 85] },
  { name: 'PVC לריצוף', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [30, 75] },
  { name: 'אדן שיש חלון', category: 'ריצוף וחיפוי', unit: 'מ"א', priceRange: [50, 150] },
  { name: 'מדרגות שיש', category: 'ריצוף וחיפוי', unit: 'מ"א', priceRange: [120, 350] },
  { name: 'פנל אלומיניום מחורר', category: 'ריצוף וחיפוי', unit: 'מ"ר', priceRange: [80, 200] },
];

// ============================================================
// PAINTS & FINISHES — צבעים וחומרי גמר
// ============================================================
const PAINTS_FINISHES: ConstructionProduct[] = [
  { name: 'צבע אקרילי פנים', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [15, 35], variants: ['1 ליטר', '5 ליטר', '10 ליטר', '18 ליטר'], commonVendors: ['טמבור', 'נירלט', 'ויטונית'] },
  { name: 'צבע חוץ סיליקוני', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [20, 45], commonVendors: ['טמבור', 'נירלט'] },
  { name: 'פריימר יסוד', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [12, 28] },
  { name: 'צבע אפוקסי רצפה', category: 'צבעים וחומרי גמר', unit: 'ק"ג', priceRange: [45, 95] },
  { name: 'לכה פוליאוריתן', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [35, 75] },
  { name: 'אנטי-ראסט', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [25, 55] },
  { name: 'צבע חום-עמיד', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [40, 80] },
  { name: 'רולר צבע 25 ס"מ', category: 'צבעים וחומרי גמר', unit: 'יח\'', priceRange: [15, 35] },
  { name: 'מסטיק אקרילי לבן', category: 'צבעים וחומרי גמר', unit: 'שפופרת', priceRange: [12, 25] },
  { name: 'נייר זכוכית P120', category: 'צבעים וחומרי גמר', unit: 'יח\'', priceRange: [3, 8], variants: ['P60', 'P80', 'P120', 'P180', 'P240'] },
  { name: 'ממס טינר', category: 'צבעים וחומרי גמר', unit: 'ליטר', priceRange: [10, 22] },
  { name: 'דבק אפוקסי דו-רכיבי', category: 'צבעים וחומרי גמר', unit: 'ק"ג', priceRange: [45, 90] },
  { name: 'חומר כימי לעוגנים', category: 'צבעים וחומרי גמר', unit: 'שפופרת', priceRange: [55, 120] },
];

// ============================================================
// GENERAL BUILDING MATERIALS — חומרי בנייה כלליים
// ============================================================
const GENERAL_BUILDING: ConstructionProduct[] = [
  { name: 'תבנית לבטון (שלוקה)', category: 'חומרי בנייה כלליים', unit: 'מ"ר', priceRange: [15, 35] },
  { name: 'פיגום צינורות', category: 'חומרי בנייה כלליים', unit: 'מ"ר', priceRange: [20, 50] },
  { name: 'תומך מתכוונן (סטמפ)', category: 'חומרי בנייה כלליים', unit: 'יח\'', priceRange: [25, 55] },
  { name: 'קורת עץ לתבנית', category: 'חומרי בנייה כלליים', unit: 'מ"א', priceRange: [12, 28] },
  { name: 'מסמר בניין 80 מ"מ', category: 'חומרי בנייה כלליים', unit: 'ק"ג', priceRange: [8, 18] },
  { name: 'חוט קשירה', category: 'חומרי בנייה כלליים', unit: 'ק"ג', priceRange: [6, 14] },
  { name: 'גיאוטקסטיל 200 גר\'', category: 'חומרי בנייה כלליים', unit: 'מ"ר', priceRange: [4, 10], variants: ['120 גר\'', '200 גר\'', '300 גר\''] },
  { name: 'גיאוגריד', category: 'חומרי בנייה כלליים', unit: 'מ"ר', priceRange: [8, 20] },
  { name: 'צינור ניקוז 110 מ"מ', category: 'חומרי בנייה כלליים', unit: 'מ"א', priceRange: [12, 28] },
  { name: 'עפר מילוי', category: 'חומרי בנייה כלליים', unit: 'מ"ק', priceRange: [30, 70] },
  { name: 'חול ים שטוף', category: 'חומרי בנייה כלליים', unit: 'טון', priceRange: [50, 100] },
  { name: 'חצץ מחצבה', category: 'חומרי בנייה כלליים', unit: 'טון', priceRange: [60, 120] },
  { name: 'אספלט חם', category: 'חומרי בנייה כלליים', unit: 'טון', priceRange: [350, 550] },
  { name: 'אמולסיה ביטומנית', category: 'חומרי בנייה כלליים', unit: 'ליטר', priceRange: [5, 12] },
  { name: 'סכך אלומיניום', category: 'חומרי בנייה כלליים', unit: 'מ"ר', priceRange: [45, 100] },
  { name: 'רשת הגנה לפיגום', category: 'חומרי בנייה כלליים', unit: 'מ"ר', priceRange: [3, 8] },
];

// ============================================================
// FASTENERS & HARDWARE — ברגים ומחברים
// ============================================================
const FASTENERS_HARDWARE: ConstructionProduct[] = [
  { name: 'בורג עץ 5×60', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [15, 35], variants: ['4×40', '4×50', '5×60', '5×80', '6×100'] },
  { name: 'בורג בטון 6×50', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [18, 40] },
  { name: 'דיבל פלסטיק 8 מ"מ', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [8, 20], variants: ['6 מ"מ', '8 מ"מ', '10 מ"מ', '12 מ"מ'] },
  { name: 'עוגן כימי M12', category: 'ברגים ומחברים', unit: 'יח\'', priceRange: [12, 30] },
  { name: 'ברגי גבס פוספט 3.5×35', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [12, 28], variants: ['3.5×25', '3.5×35', '3.5×45', '3.5×55'] },
  { name: 'אום הקס M10', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [10, 25], variants: ['M6', 'M8', 'M10', 'M12', 'M16'] },
  { name: 'שייבה שטוחה M10', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [8, 18] },
  { name: 'בורג הקס M10×50', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [20, 45] },
  { name: 'מסמר יריה לבטון', category: 'ברגים ומחברים', unit: 'קופסה', priceRange: [25, 55] },
  { name: 'ציר כבד', category: 'ברגים ומחברים', unit: 'יח\'', priceRange: [8, 22] },
  { name: 'מנעול תלייה', category: 'ברגים ומחברים', unit: 'יח\'', priceRange: [25, 65] },
  { name: 'טיח רשת פיברגלס', category: 'ברגים ומחברים', unit: 'מ"ר', priceRange: [5, 12] },
];

// ============================================================
// TOOLS — כלי עבודה
// ============================================================
const TOOLS: ConstructionProduct[] = [
  { name: 'מקדחה אימפקט 18V', category: 'כלי עבודה', unit: 'יח\'', priceRange: [350, 900], commonVendors: ['מקיטה', 'בוש', 'דוולט', 'מילווקי'] },
  { name: 'משחזת זווית 125 מ"מ', category: 'כלי עבודה', unit: 'יח\'', priceRange: [150, 450] },
  { name: 'מסור דיסק 185 מ"מ', category: 'כלי עבודה', unit: 'יח\'', priceRange: [300, 800] },
  { name: 'פטיש סיפרה 5 ק"ג', category: 'כלי עבודה', unit: 'יח\'', priceRange: [120, 350] },
  { name: 'רוטורי האמר SDS', category: 'כלי עבודה', unit: 'יח\'', priceRange: [400, 1200] },
  { name: 'קומפרסור 50 ליטר', category: 'כלי עבודה', unit: 'יח\'', priceRange: [600, 1800] },
  { name: 'ויברטור לבטון', category: 'כלי עבודה', unit: 'יח\'', priceRange: [300, 900] },
  { name: 'מסור חיתוך אריחים', category: 'כלי עבודה', unit: 'יח\'', priceRange: [200, 600] },
  { name: 'פלס לייזר', category: 'כלי עבודה', unit: 'יח\'', priceRange: [200, 800] },
  { name: 'דיסק יהלום 230 מ"מ', category: 'כלי עבודה', unit: 'יח\'', priceRange: [35, 120] },
  { name: 'מטר מדידה 5 מטר', category: 'כלי עבודה', unit: 'יח\'', priceRange: [15, 45] },
  { name: 'כף טייח', category: 'כלי עבודה', unit: 'יח\'', priceRange: [20, 55] },
  { name: 'מברגה חשמלית 18V', category: 'כלי עבודה', unit: 'יח\'', priceRange: [250, 700] },
  { name: 'סולם אלומיניום 3 מטר', category: 'כלי עבודה', unit: 'יח\'', priceRange: [200, 550] },
  { name: 'עגלת שינוע', category: 'כלי עבודה', unit: 'יח\'', priceRange: [150, 400] },
];

// ============================================================
// SAFETY EQUIPMENT — בטיחות
// ============================================================
const SAFETY: ConstructionProduct[] = [
  { name: 'קסדת בטיחות', category: 'בטיחות', unit: 'יח\'', priceRange: [25, 65] },
  { name: 'נעלי בטיחות S3', category: 'בטיחות', unit: 'זוג', priceRange: [120, 350] },
  { name: 'רתמת גוף מלא', category: 'בטיחות', unit: 'יח\'', priceRange: [200, 500] },
  { name: 'חבל עם קליפס', category: 'בטיחות', unit: 'יח\'', priceRange: [80, 200] },
  { name: 'כפפות עבודה', category: 'בטיחות', unit: 'זוג', priceRange: [8, 25] },
  { name: 'משקפי מגן', category: 'בטיחות', unit: 'יח\'', priceRange: [10, 30] },
  { name: 'אוזניות מגן', category: 'בטיחות', unit: 'יח\'', priceRange: [15, 45] },
  { name: 'אפוד זוהר', category: 'בטיחות', unit: 'יח\'', priceRange: [15, 35] },
  { name: 'מסכת אבק P2', category: 'בטיחות', unit: 'קופסה', priceRange: [25, 65] },
  { name: 'מטף כיבוי 6 ק"ג', category: 'בטיחות', unit: 'יח\'', priceRange: [80, 180] },
  { name: 'תיבת עזרה ראשונה', category: 'בטיחות', unit: 'יח\'', priceRange: [60, 150] },
  { name: 'שילוט בטיחות', category: 'בטיחות', unit: 'יח\'', priceRange: [15, 40] },
  { name: 'גדר בטיחות זמנית', category: 'בטיחות', unit: 'מ"א', priceRange: [20, 50] },
];

// ============================================================
// DOORS & WINDOWS — דלתות וחלונות
// ============================================================
const DOORS_WINDOWS: ConstructionProduct[] = [
  { name: 'דלת פלדה מגולוונת', category: 'דלתות וחלונות', unit: 'יח\'', priceRange: [450, 1200] },
  { name: 'דלת עץ פנים', category: 'דלתות וחלונות', unit: 'יח\'', priceRange: [350, 900] },
  { name: 'דלת אש EI60', category: 'דלתות וחלונות', unit: 'יח\'', priceRange: [1200, 3500] },
  { name: 'חלון אלומיניום הזזה', category: 'דלתות וחלונות', unit: 'מ"ר', priceRange: [350, 800] },
  { name: 'חלון PVC דו-כנף', category: 'דלתות וחלונות', unit: 'מ"ר', priceRange: [300, 700] },
  { name: 'זכוכית מחוסמת 8 מ"מ', category: 'דלתות וחלונות', unit: 'מ"ר', priceRange: [120, 280] },
  { name: 'זכוכית תרמית דו-שכבתית', category: 'דלתות וחלונות', unit: 'מ"ר', priceRange: [180, 400] },
  { name: 'תריס גלילה חשמלי', category: 'דלתות וחלונות', unit: 'מ"ר', priceRange: [200, 500] },
  { name: 'משקוף מגולוון', category: 'דלתות וחלונות', unit: 'יח\'', priceRange: [80, 200] },
  { name: 'מעקה בטיחות', category: 'דלתות וחלונות', unit: 'מ"א', priceRange: [200, 500] },
  { name: 'פרזול דלת', category: 'דלתות וחלונות', unit: 'סט', priceRange: [80, 250] },
];

// ============================================================
// COMBINE ALL
// ============================================================
const ALL_CATEGORIES = [
  CONCRETE_CEMENT,
  STEEL_REBAR,
  BLOCKS_BRICKS,
  WATERPROOFING_INSULATION,
  PLUMBING,
  ELECTRICAL,
  WOOD_CARPENTRY,
  TILING_FLOORING,
  PAINTS_FINISHES,
  GENERAL_BUILDING,
  FASTENERS_HARDWARE,
  TOOLS,
  SAFETY,
  DOORS_WINDOWS,
];

// ============================================================
// SUPPLIER NAMES — Real Israeli construction material suppliers
// ============================================================
const SUPPLIERS = [
  // Concrete & aggregates
  { name: 'רדימיקס', categories: ['בטון ומלט'] },
  { name: 'המנור בטון', categories: ['בטון ומלט'] },
  { name: 'בטון דרום', categories: ['בטון ומלט'] },
  { name: 'אחים דויטש מחצבות', categories: ['בטון ומלט', 'חומרי בנייה כלליים'] },
  { name: 'מחצבות הר-טוב', categories: ['בטון ומלט', 'חומרי בנייה כלליים'] },
  { name: 'נשר מפעלי מלט', categories: ['בטון ומלט'] },

  // Steel
  { name: 'איסכור שירותי פלדה', categories: ['ברזל ופלדה'] },
  { name: 'ברזל צפון', categories: ['ברזל ופלדה'] },
  { name: 'פלדות אלון', categories: ['ברזל ופלדה'] },
  { name: 'ח.י. ברזל', categories: ['ברזל ופלדה'] },
  { name: 'ברזל המרכז', categories: ['ברזל ופלדה'] },

  // Blocks & bricks
  { name: 'איטונג', categories: ['בלוקים ולבנים'] },
  { name: 'בלוקאן', categories: ['בלוקים ולבנים'] },
  { name: 'מפעלי בלוקים נען', categories: ['בלוקים ולבנים'] },
  { name: 'אשדות יעקב בלוקים', categories: ['בלוקים ולבנים'] },

  // Waterproofing & insulation
  { name: 'סיקה ישראל', categories: ['איטום ובידוד', 'בטון ומלט'] },
  { name: 'פזנר', categories: ['איטום ובידוד'] },
  { name: 'איזומיט', categories: ['איטום ובידוד'] },
  { name: 'אורבונד', categories: ['איטום ובידוד'] },
  { name: 'טרמוקיר', categories: ['איטום ובידוד'] },
  { name: 'פולירם', categories: ['איטום ובידוד'] },

  // Plumbing
  { name: 'פלסאון', categories: ['אינסטלציה'] },
  { name: 'ניבו אינסטלציה', categories: ['אינסטלציה'] },
  { name: 'אמג"ל', categories: ['אינסטלציה'] },
  { name: 'מי-גל', categories: ['אינסטלציה'] },

  // Electrical
  { name: 'חברת החשמל לישראל', categories: ['חשמל'] },
  { name: 'הגר חשמל', categories: ['חשמל'] },
  { name: 'שניידר אלקטריק', categories: ['חשמל'] },
  { name: 'ABB ישראל', categories: ['חשמל'] },
  { name: 'כבלי חשמל חיפה', categories: ['חשמל'] },

  // Wood
  { name: 'עצי ישראל', categories: ['עץ ונגרות'] },
  { name: 'חברת העץ', categories: ['עץ ונגרות'] },
  { name: 'קנוף ישראל', categories: ['עץ ונגרות', 'גבס ותקרות'] },

  // Tiling
  { name: 'ניר עציון אריחים', categories: ['ריצוף וחיפוי'] },
  { name: 'קיסר', categories: ['ריצוף וחיפוי'] },
  { name: 'ספנסר', categories: ['ריצוף וחיפוי'] },

  // Paints
  { name: 'טמבור', categories: ['צבעים וחומרי גמר', 'בטון ומלט'] },
  { name: 'נירלט', categories: ['צבעים וחומרי גמר'] },
  { name: 'ויטונית', categories: ['צבעים וחומרי גמר'] },

  // General / multi-category
  { name: 'שטרן את שטרן', categories: ['חומרי בנייה כלליים', 'ברגים ומחברים', 'כלי עבודה'] },
  { name: 'אייל ארד חומרי בנייה', categories: ['חומרי בנייה כלליים', 'בטון ומלט'] },
  { name: 'א.א. חומרי בנייה', categories: ['חומרי בנייה כלליים'] },
  { name: 'מרכז הבנייה', categories: ['חומרי בנייה כלליים', 'ברגים ומחברים'] },
  { name: 'בן ארי חומרי בנייה', categories: ['חומרי בנייה כלליים'] },
  { name: 'מחסני ברזל ובנייה', categories: ['ברזל ופלדה', 'חומרי בנייה כלליים'] },
  { name: 'חומרי בנייה הצפון', categories: ['חומרי בנייה כלליים'] },
  { name: 'חי חומרי בנייה', categories: ['חומרי בנייה כלליים'] },
  { name: 'דניאל חומרי בנייה', categories: ['חומרי בנייה כלליים'] },

  // Tools
  { name: 'מקיטה ישראל', categories: ['כלי עבודה'] },
  { name: 'בוש ישראל', categories: ['כלי עבודה'] },
  { name: 'הילטי', categories: ['כלי עבודה', 'ברגים ומחברים'] },
  { name: 'דוולט', categories: ['כלי עבודה'] },

  // Safety
  { name: 'טלדור בטיחות', categories: ['בטיחות'] },
  { name: 'קסטל ציוד בטיחות', categories: ['בטיחות'] },

  // Doors & windows
  { name: 'אלומילק', categories: ['דלתות וחלונות'] },
  { name: 'קליל תעשיות', categories: ['דלתות וחלונות'] },
  { name: 'רב בריח', categories: ['דלתות וחלונות'] },
  { name: 'פנדור', categories: ['דלתות וחלונות'] },
];


// ============================================================
// Generate the output file
// ============================================================
interface OutputProduct {
  name: string;
  category: string;
  unit: string;
  avgPrice: number;
  variants?: string[];
  commonVendors?: string[];
}

async function main() {
  console.log('Building curated construction products database...\n');

  const allProducts: OutputProduct[] = [];

  for (const categoryProducts of ALL_CATEGORIES) {
    for (const p of categoryProducts) {
      const avgPrice = Math.round((p.priceRange[0] + p.priceRange[1]) / 2);
      const product: OutputProduct = {
        name: p.name,
        category: p.category,
        unit: p.unit,
        avgPrice,
      };
      if (p.variants) product.variants = p.variants;
      if (p.commonVendors) product.commonVendors = p.commonVendors;
      allProducts.push(product);

      // Also generate variant entries as separate products
      if (p.variants) {
        for (const variant of p.variants) {
          // Skip if the base name already contains this variant
          if (p.name.includes(variant)) continue;

          const variantName = `${p.name.replace(/\s*\d+[\s×x].*$/, '')} ${variant}`.trim();
          // Avoid duplicates
          if (variantName !== p.name && !allProducts.some(x => x.name === variantName && x.category === p.category)) {
            const priceVariation = 0.7 + Math.random() * 0.6; // ±30%
            allProducts.push({
              name: variantName,
              category: p.category,
              unit: p.unit,
              avgPrice: Math.round(avgPrice * priceVariation),
            });
          }
        }
      }
    }
  }

  // Sort by category then name
  allProducts.sort((a, b) =>
    a.category.localeCompare(b.category, 'he') || a.name.localeCompare(b.name, 'he')
  );

  // Write products
  const fs = await import('fs');
  const path = await import('path');
  const outDir = new URL('./output', import.meta.url).pathname;
  fs.mkdirSync(outDir, { recursive: true });

  const productsPath = path.join(outDir, 'construction-products.json');
  fs.writeFileSync(productsPath, JSON.stringify(allProducts, null, 2));

  // Write suppliers
  const suppliersPath = path.join(outDir, 'suppliers.json');
  fs.writeFileSync(suppliersPath, JSON.stringify(SUPPLIERS, null, 2));

  // Stats
  const categories = new Map<string, number>();
  for (const p of allProducts) {
    categories.set(p.category, (categories.get(p.category) || 0) + 1);
  }

  console.log(`סה"כ ${allProducts.length} מוצרים ב-${categories.size} קטגוריות\n`);
  console.log('לפי קטגוריה:');
  for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nספקים: ${SUPPLIERS.length}`);
  console.log(`\nOutput:`);
  console.log(`  ${productsPath}`);
  console.log(`  ${suppliersPath}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
