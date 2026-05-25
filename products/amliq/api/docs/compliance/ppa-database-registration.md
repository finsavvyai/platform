# PPA database registration submission — AMLIQ-screening

Last updated: 2026-04-29.
Owner: legal lead (filing) + security lead (technical fields).
Form: רשם מאגרי המידע / Registrar of Databases — online form at
`gov.il`. This document is the **content** to paste into that form.
The Privacy Protection Authority (PPA, רשות הגנת הפרטיות) reviews
the submission; registration is mandatory for any database holding
sensitive personal information of more than 10,000 subjects under
§8 of the Privacy Protection Law 5741-1981.

## 1. Identifying details (פרטים מזהים)

| Field | Value |
|---|---|
| שם המאגר (Database name) | AMLIQ-screening |
| מספר רישום (assigned by PPA) | TBD — fill on submission |
| בעל המאגר (Database owner) | [Company legal name] |
| ח.פ / ע.מ (Registration no.) | [Company CRN] |
| מנהל המאגר (Database manager) | [Name + ID] |
| מחזיק המאגר (Holder, if different) | Same as owner |
| קצין הגנת פרטיות (Privacy officer) | [Name + email] — appointed per §17b |
| כתובת (Address) | [Registered office] |
| טלפון (Phone) | [Phone] |
| דוא"ל (Email) | TBD — דומיין amliq.ai טרם פעיל (HTTP=000 ב-2026-04-29). למלא לפני הגשה. |

## 2. Purpose of the database (§3 of the form)

המאגר נועד לאפשר ללקוחות AMLIQ לקיים את חובות הציות לפי חוק
איסור הלבנת הון, התש"ס-2000 וחוק איסור מימון טרור, התשס"ה-2005,
על-ידי השוואת זהויות נסקרות מול רשימות סנקציות, רשימות אנשי
ציבור (PEP), רשימות של ה-NBCTF ורשימות נוספות שמתפרסמות על-ידי
רגולטורים בארץ ובחו"ל.

המאגר נועד לשרת **אך ורק את הלקוחות העסקיים שלנו** ולא את הציבור
הרחב; המידע המעובד הוא מידע ציבורי המתפרסם על-ידי רגולטורים, וכן
מידע פעולה (לוגים) של בקשות סקירה שהלקוחות שולחים.

## 3. Categories of subjects (§4 of the form)

| Category | Source |
|---|---|
| בעלי תפקידים ציבוריים (PEPs) | OpenSanctions, Wikidata SPARQL, NBCTF |
| אנשים על רשימות סנקציות | OFAC, UN, EU, UK OFSI, NBCTF |
| יחידים שלקוחות פנו לסקור | קלט ישיר של הלקוח, לא שמור מעבר ל-90 יום (תוצאה) ו-365 יום (התראה) |

## 4. Categories of information (§5 of the form)

- שם מלא, שמות אליאס.
- שם בעברית (אם קיים).
- מדינת אזרחות / תושבות.
- מספרי זיהוי ציבוריים (תעודת זהות, דרכון, ח"פ).
- תפקיד ציבורי, תאריך מילוי תפקיד (PEPs בלבד).
- ציטוט מקור הרישום (URL של הרשימה הציבורית).

המאגר **אינו** מכיל מידע ביומטרי, רפואי, גזעי, דתי, או נטיה
מינית. סווג רגישות: **פרטים אישיים** (ולא "מידע רגיש" כהגדרתו
בסעיף 7 לחוק).

## 5. Sources of data (§6 of the form)

| Source | URL | Frequency |
|---|---|---|
| OFAC SDN | treasury.gov/ofac | Daily |
| OpenSanctions FTM | data.opensanctions.org | Daily |
| NBCTF (Israel MoD) | nbctf.mod.gov.il | Weekly |
| Wikidata SPARQL | query.wikidata.org | On schedule (weekly) |
| GLEIF LEI | gleif.org | Daily |
| Customer-supplied screening payloads | API calls | Real-time |

## 6. Data security level (§7 of the form)

לפי תקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017, סעיף 1, המאגר
מסווג ברמת אבטחה **גבוהה** ("רמת אבטחה גבוהה") על בסיס:

- מספר נושאי המידע > 100,000.
- יותר מ-10 משתמשים בעלי הרשאת גישה.
- העברה של מידע אל מחוץ לארגון (לקוחות B2B).

הבקרות המוטמעות מפורטות במסמך `docs/compliance/israel.md` סעיף 2.

## 7. Cross-border transfer (§8 of the form)

**סטטוס: לפני השקה — אין כרגע ייצור פומבי.** האזור המתוכנן
לייצור הוא EU-Frankfurt תחת תקנות העברת מידע מחוץ לגבולות
המדינה, התשס"א-2001, על בסיס הסכם רגולטיבי GDPR שבין האיחוד
האירופי לישראל.

ללקוחות הדורשים תושב נתונים בישראל, נציע אזור il-central-1
(AWS Israel) כשיהיה זמין מבחינה תפעולית. מועד יעד עדיין לא
מחויב — להשלים לפני ההגשה הסופית.

## 8. Data retention (§9 of the form)

| Type | Retention |
|---|---|
| תוצאות סקירה | 90 יום |
| התראות | 365 יום |
| יומן ביקורת (audit log) | 7 שנים (לפי §7 לצו איסור הלבנת הון (חובות זיהוי, דיווח וניהול רישומים של נותני שירות עסקי), התשע"ג-2013) |
| נתוני רשימות ציבוריות | מתעדכן רציף, אין שמירה היסטורית מעבר ל-12 חודשים |

## 9. Subject rights (§10 of the form)

| זכות | סעיף בחוק | מימוש |
|---|---|---|
| עיון | §13 | פנייה למייל פרטיות (כתובת תיקבע לפני השקה — דומיין amliq.ai טרם פעיל ב-2026-04-29); מענה תוך 30 יום |
| תיקון | §14 | אותה כתובת או פנל הניהול |
| מחיקה | §14א | `POST /api/v1/privacy/erase` (לקוחות) או פנייה למייל פרטיות (כתובת תיקבע לפני השקה) |
| תלונה ל-PPA | תקנה 12 | לרשם מאגרי המידע באתר gov.il |

## 10. Incident response

חובת דיווח על אירוע אבטחת מידע: עד 24 שעות לרשם מאגרי המידע, עד
72 שעות לנושאי המידע המושפעים. תהליך מלא ב-`docs/compliance/
incident-response-playbook.md`. תבנית מסמך הדיווח לרשם: `docs/
compliance/ppa-breach-template.md` (לכתיבה לפני ההגשה הסופית).

## 11. Annual security audit

המאגר מסווג ברמה גבוהה ולכן חובה ביקורת שנתית על-ידי בודק אבטחת
מידע מורשה. הזמנת הביקורת מבוצעת על-ידי security lead לפני
הפעלת לקוחות מסחריים בישראל.

## 12. What still needs to be filled before submission

- שם הבעלים החוקי + ח.פ.
- שם, ת.ז ודוא"ל של מנהל המאגר.
- שם ופרטי קצין הגנת פרטיות (DPO).
- כתובת רישום.
- ביקורת אבטחה שנתית — בחירת הבודק.
- סטטוס השרת בישראל (אם מבוטל, השאר את EU-Frankfurt).

לאחר השלמה, הסעיפים 1–11 מועתקים פנימה לטופס המקוון של רשם מאגרי
המידע ב-gov.il. הגרסה של המסמך הזה ב-Git משמשת כראיה לאוּדיטור
שהתוכן שהוגש זהה למה שמופיע במאגר התיעוד שלנו.
