import type { AppLocale } from '@/lib/i18n/events';

/** Bilingual guide copy — keeps AR/EN next to each topic for a full-app handbook. */
export type L = { en: string; ar: string };

export type UserGuideTopic = {
  id: string;
  /** Sidebar group key */
  moduleId: string;
  title: L;
  summary: L;
  /** Deep link into the feature */
  href?: string;
  steps?: L[];
  tips?: L[];
  warnings?: L[];
};

export type UserGuideModule = {
  id: string;
  title: L;
  blurb: L;
};

export function guideText(value: L, locale: AppLocale): string {
  return locale === 'ar' ? value.ar : value.en;
}

export const USER_GUIDE_MODULES: UserGuideModule[] = [
  {
    id: 'basics',
    title: { en: 'Basics', ar: 'الأساسيات' },
    blurb: {
      en: 'Sign-in, language, search, and first-day setup.',
      ar: 'تسجيل الدخول واللغة والبحث وإعداد اليوم الأول.',
    },
  },
  {
    id: 'dashboard',
    title: { en: 'Dashboard', ar: 'لوحة المعلومات' },
    blurb: {
      en: 'Daily overview, quick actions, and what needs attention.',
      ar: 'نظرة يومية وإجراءات سريعة وما يحتاج انتباهك.',
    },
  },
  {
    id: 'sales',
    title: { en: 'Sales (CRM)', ar: 'المبيعات (CRM)' },
    blurb: {
      en: 'Leads, opportunities, quotations, proposals, pipelines.',
      ar: 'العملاء المحتملون والفرص وعروض الأسعار والمقترحات والمسارات.',
    },
  },
  {
    id: 'invoices',
    title: { en: 'Invoices & Quick Sale', ar: 'الفواتير والبيع السريع' },
    blurb: {
      en: 'Customer invoices, payments, and walk-in POS billing.',
      ar: 'فواتير العملاء والمدفوعات وفوترة نقطة البيع.',
    },
  },
  {
    id: 'purchases',
    title: { en: 'Purchases & Vendors', ar: 'المشتريات والموردون' },
    blurb: {
      en: 'Suppliers, purchase requests, orders, and receiving stock.',
      ar: 'الموردون وطلبات الشراء وأوامر الشراء واستلام المخزون.',
    },
  },
  {
    id: 'inventory',
    title: { en: 'Inventory', ar: 'المخزون' },
    blurb: {
      en: 'Products, stock, categories, warehouses, and CSV import.',
      ar: 'المنتجات والمخزون والتصنيفات والمستودعات واستيراد CSV.',
    },
  },
  {
    id: 'customers',
    title: { en: 'Customers', ar: 'العملاء' },
    blurb: {
      en: 'People and businesses you sell to, contacts, and notes.',
      ar: 'الأشخاص والشركات التي تبيع لها وجهات الاتصال والملاحظات.',
    },
  },
  {
    id: 'accounting',
    title: { en: 'Accounting', ar: 'المحاسبة' },
    blurb: {
      en: 'Cash, receivables, payables, journals, and CSV exports.',
      ar: 'النقدية والمستحقات والدائنون والقيود وتصدير CSV.',
    },
  },
  {
    id: 'hr',
    title: { en: 'HR & Payroll', ar: 'الموارد البشرية والرواتب' },
    blurb: {
      en: 'Employees, leave, attendance, and payroll runs.',
      ar: 'الموظفون والإجازات والحضور وتشغيل الرواتب.',
    },
  },
  {
    id: 'reports',
    title: { en: 'Reports & Alerts', ar: 'التقارير والتنبيهات' },
    blurb: {
      en: 'Business numbers, notifications, and document files.',
      ar: 'أرقام الأعمال والإشعارات وملفات المستندات.',
    },
  },
  {
    id: 'settings',
    title: { en: 'Settings & Team', ar: 'الإعدادات والفريق' },
    blurb: {
      en: 'Profile, localization, billing, users, and roles.',
      ar: 'الملف والتعريب والفوترة والمستخدمون والأدوار.',
    },
  },
];

export const USER_GUIDE_TOPICS: UserGuideTopic[] = [
  // —— Basics ——
  {
    id: 'shell-overview',
    moduleId: 'basics',
    title: { en: 'How the workspace is organized', ar: 'كيف تُنظَّم مساحة العمل' },
    summary: {
      en: 'The left menu is your map. Top bar has search, language, notifications, and your profile. Use everyday business words — not ERP jargon.',
      ar: 'القائمة اليسرى هي خريطتك. الشريط العلوي فيه البحث واللغة والإشعارات وملفك. نستخدم كلمات أعمال يومية — وليس مصطلحات ERP المعقدة.',
    },
    steps: [
      {
        en: 'Left sidebar: Dashboard, Sales, Invoices, Purchases, Inventory, Customers, Vendors, Accounting, HR & Payroll, Reports, Settings, User guide.',
        ar: 'القائمة اليسرى: لوحة المعلومات، المبيعات، الفواتير، المشتريات، المخزون، العملاء، الموردون، المحاسبة، الموارد البشرية، التقارير، الإعدادات، دليل المستخدم.',
      },
      {
        en: 'Top search: find products, invoices, documents, customers, vendors, employees.',
        ar: 'بحث أعلى الصفحة: ابحث عن منتجات أو فواتير أو مستندات أو عملاء أو موردين أو موظفين.',
      },
      {
        en: 'Language toggle: العربية / English (applies across the app).',
        ar: 'تبديل اللغة: العربية / English (يطبَّق على التطبيق كله).',
      },
      {
        en: 'Bell icon: notifications. “View All Notifications” opens Alerts.',
        ar: 'أيقونة الجرس: الإشعارات. «عرض كل التنبيهات» يفتح صفحة التنبيهات.',
      },
      {
        en: '“+ Quick create” (bottom-right): shortcut to invoice, customer, product, payment, quotation, purchase.',
        ar: '«+ إنشاء سريع» (أسفل اليمين): اختصار لفاتورة أو عميل أو منتج أو دفعة أو عرض سعر أو شراء.',
      },
    ],
  },
  {
    id: 'first-day',
    moduleId: 'basics',
    title: { en: 'First-day setup checklist', ar: 'قائمة إعداد اليوم الأول' },
    summary: {
      en: 'Do these once so the rest of the system works smoothly.',
      ar: 'نفّذ هذه الخطوات مرة واحدة حتى يعمل باقي النظام بسلاسة.',
    },
    href: '/app/settings',
    steps: [
      {
        en: 'Settings → confirm language, currency, and business localization.',
        ar: 'الإعدادات ← تأكد من اللغة والعملة وتعريب الأعمال.',
      },
      {
        en: 'Settings → Workspace admin → complete company profile (name, CR/VAT if Saudi).',
        ar: 'الإعدادات ← إدارة مساحة العمل ← أكمل ملف الشركة (الاسم والسجل/الضريبة إن وُجد).',
      },
      {
        en: 'Inventory → add Categories and at least one Warehouse.',
        ar: 'المخزون ← أضف التصنيفات ومستودعاً واحداً على الأقل.',
      },
      {
        en: 'Add a few Products (or Import CSV), then one Customer.',
        ar: 'أضف بضعة منتجات (أو استورد CSV)، ثم عميلاً واحداً.',
      },
      {
        en: 'Create a test Invoice or Quick Sale to verify the flow end-to-end.',
        ar: 'أنشئ فاتورة تجريبية أو بيعاً سريعاً للتحقق من المسار كاملاً.',
      },
      {
        en: 'Invite teammates from Workspace admin → Invitations (owners/admins).',
        ar: 'ادعُ الفريق من إدارة مساحة العمل ← الدعوات (للمالك/المديرين).',
      },
    ],
    tips: [
      {
        en: 'Recommended order: Settings → Warehouses/Categories → Products → Customers → Sales/Invoices → Purchases.',
        ar: 'الترتيب المقترح: الإعدادات ← المستودعات/التصنيفات ← المنتجات ← العملاء ← المبيعات/الفواتير ← المشتريات.',
      },
    ],
  },
  {
    id: 'roles',
    moduleId: 'basics',
    title: { en: 'Roles & who can do what', ar: 'الأدوار ومن يستطيع ماذا' },
    summary: {
      en: 'Buttons hide when your role cannot write. If you cannot create or import, ask an owner/admin.',
      ar: 'تختفي الأزرار إذا لم يكن لدورك صلاحية الكتابة. إن لم تستطع الإنشاء أو الاستيراد، اطلب من المالك/المدير.',
    },
    href: '/app/settings/admin',
    tips: [
      {
        en: 'Owner / Admin: full workspace, billing, users, inventory write.',
        ar: 'المالك / المدير: مساحة العمل كاملة، الفوترة، المستخدمون، كتابة المخزون.',
      },
      {
        en: 'Department admin: often inventory/procurement write within scope.',
        ar: 'مدير القسم: غالباً كتابة المخزون/المشتريات ضمن نطاقه.',
      },
      {
        en: 'User: usually read inventory; limited create on CRM/invoices depending on presets.',
        ar: 'المستخدم: عادة قراءة المخزون؛ إنشاء محدود في CRM/الفواتير حسب الإعدادات.',
      },
    ],
    warnings: [
      {
        en: 'Import CSV and Create product need inventory write access.',
        ar: 'استيراد CSV وإنشاء منتج يحتاجان صلاحية كتابة المخزون.',
      },
    ],
  },

  // —— Dashboard ——
  {
    id: 'dashboard-use',
    moduleId: 'dashboard',
    title: { en: 'Using the Dashboard', ar: 'استخدام لوحة المعلومات' },
    summary: {
      en: 'Your daily home: greeting, onboarding checklist, one-tap actions, KPIs, and items that need attention.',
      ar: 'صفحتك اليومية: التحية وقائمة البداية والإجراءات السريعة والمؤشرات وما يحتاج انتباهك.',
    },
    href: '/app',
    steps: [
      {
        en: 'Open Dashboard from the sidebar (or after login).',
        ar: 'افتح لوحة المعلومات من القائمة (أو بعد تسجيل الدخول).',
      },
      {
        en: 'Use “What do you want to do today?” cards: Create Invoice, Add Customer, Add Product, Record Payment, Create Quotation, Add Purchase.',
        ar: 'استخدم بطاقات «ماذا تريد أن تفعل اليوم؟»: إنشاء فاتورة، إضافة عميل، إضافة منتج، تسجيل دفعة، إنشاء عرض سعر، إضافة شراء.',
      },
      {
        en: 'Check KPI tiles (Customers, Open quotes, Products, Low stock) for health at a glance.',
        ar: 'راجع مربعات المؤشرات (العملاء، العروض المفتوحة، المنتجات، المخزون المنخفض) لصحة العمل بسرعة.',
      },
      {
        en: 'Complete or dismiss Getting started steps (logo, first customer, first invoice, invite team).',
        ar: 'أكمل أو أغلق خطوات البداية (الشعار، أول عميل، أول فاتورة، دعوة الفريق).',
      },
      {
        en: 'Open “Needs your attention” links for pending purchases or open opportunities.',
        ar: 'افتح روابط «يحتاج انتباهك» للمشتريات المعلقة أو الفرص المفتوحة.',
      },
    ],
  },

  // —— Sales ——
  {
    id: 'sales-overview',
    moduleId: 'sales',
    title: { en: 'Sales module overview', ar: 'نظرة عامة على المبيعات' },
    summary: {
      en: 'Sales CRM covers the journey from lead to quotation. Sidebar “Sales” opens Leads; use the Sales sub-nav for Opportunities, Quotations, Proposals, Assets, Pipelines, Templates.',
      ar: 'مبيعات CRM تغطي المسار من العميل المحتمل إلى عرض السعر. «المبيعات» في القائمة تفتح العملاء المحتملين؛ استخدم شريط المبيعات الفرعي للفرص والعروض والمقترحات والأصول والمسارات والقوالب.',
    },
    href: '/app/sales-crm',
    tips: [
      {
        en: 'Typical path: Lead → Opportunity → Quotation → Invoice (or Proposal PDF).',
        ar: 'المسار المعتاد: عميل محتمل ← فرصة ← عرض سعر ← فاتورة (أو مقترح PDF).',
      },
      {
        en: 'You usually need a Customer record before creating quotations.',
        ar: 'غالباً تحتاج سجل عميل قبل إنشاء عروض الأسعار.',
      },
    ],
  },
  {
    id: 'sales-leads',
    moduleId: 'sales',
    title: { en: 'Leads', ar: 'العملاء المحتملون' },
    summary: {
      en: 'Capture new interest: company, contact, email, phone, source, notes. Convert when ready; archive when done.',
      ar: 'سجّل الاهتمام الجديد: الشركة، جهة الاتصال، البريد، الهاتف، المصدر، الملاحظات. حوّل عند الجاهزية؛ أرشِف عند الانتهاء.',
    },
    href: '/app/crm/leads',
    steps: [
      {
        en: 'Go to Sales → Leads.',
        ar: 'اذهب إلى المبيعات ← العملاء المحتملون.',
      },
      {
        en: 'Fill New lead (company name required) → Add lead.',
        ar: 'املأ عميل محتمل جديد (اسم الشركة مطلوب) ← إضافة.',
      },
      {
        en: 'Filter by status (New, Contacted, Qualified…) or search by name.',
        ar: 'صفِّ حسب الحالة (جديد، تم التواصل، مؤهل…) أو ابحث بالاسم.',
      },
      {
        en: 'Use Convert to move a qualified lead forward, or Archive to close it.',
        ar: 'استخدم تحويل لنقل عميل مؤهل للأمام، أو أرشفة لإغلاقه.',
      },
    ],
  },
  {
    id: 'sales-opportunities',
    moduleId: 'sales',
    title: { en: 'Opportunities & pipelines', ar: 'الفرص ومسارات البيع' },
    summary: {
      en: 'Track deals on a board or list. Move stages, set value and expected close, mark Won/Lost.',
      ar: 'تابع الصفقات على لوحة أو قائمة. انقل المراحل، عيّن القيمة وتاريخ الإغلاق المتوقع، وسمِّها رابحة/خاسرة.',
    },
    href: '/app/crm/opportunities',
    steps: [
      {
        en: 'Sales → Opportunities. Choose Board or List view.',
        ar: 'المبيعات ← الفرص. اختر عرض اللوحة أو القائمة.',
      },
      {
        en: 'Create New opportunity (title, pipeline, stage, optional customer, value).',
        ar: 'أنشئ فرصة جديدة (العنوان، المسار، المرحلة، عميل اختياري، القيمة).',
      },
      {
        en: 'Drag or move between stages while status is Open.',
        ar: 'اسحب أو انقل بين المراحل بينما الحالة مفتوحة.',
      },
      {
        en: 'Sales → Pipelines: create pipelines/stages, set Default pipeline, adjust probability %.',
        ar: 'المبيعات ← المسارات: أنشئ مسارات/مراحل، عيّن المسار الافتراضي، اضبط نسبة الاحتمال.',
      },
    ],
    warnings: [
      {
        en: 'Kanban board works best when filter is Open and a pipeline exists.',
        ar: 'لوحة كانبان تعمل بأفضل شكل عندما يكون الفلتر «مفتوح» ويوجد مسار.',
      },
    ],
  },
  {
    id: 'sales-quotations',
    moduleId: 'sales',
    title: { en: 'Quotations & proposals', ar: 'عروض الأسعار والمقترحات' },
    summary: {
      en: 'Build priced quotes for customers, send them, download PDF, and optionally generate proposal PDFs from templates.',
      ar: 'ابنِ عروض أسعار للعملاء، أرسلها، نزّل PDF، ويمكنك إنشاء مقترحات PDF من القوالب.',
    },
    href: '/app/crm/quotations',
    steps: [
      {
        en: 'Sales → Quotations → New quotation (pick Customer). Optional: linked opportunity, valid until, scope, terms.',
        ar: 'المبيعات ← عروض الأسعار ← عرض جديد (اختر العميل). اختياري: فرصة مرتبطة، صالح حتى، النطاق، الشروط.',
      },
      {
        en: 'Add line items from inventory products/services while still Draft.',
        ar: 'أضف بنوداً من منتجات/خدمات المخزون أثناء كون العرض مسودة.',
      },
      {
        en: 'Send, Approve/Reject, Cancel, Clone, or open detail for PDF / Generate Proposal.',
        ar: 'أرسل، وافق/ارفض، ألغِ، انسخ، أو افتح التفاصيل لـ PDF / إنشاء مقترح.',
      },
      {
        en: 'Sales → Templates: save reusable proposal cover/scope/terms. Sales → Proposals: generate versioned PDFs.',
        ar: 'المبيعات ← القوالب: احفظ غلاف/نطاق/شروط قابلة لإعادة الاستخدام. المبيعات ← المقترحات: أنشئ PDF بإصدارات.',
      },
      {
        en: 'Sales → Assets: upload brochures/certs for quotation packs.',
        ar: 'المبيعات ← الأصول: ارفع كتيبات/شهادات لحزم العروض.',
      },
    ],
    tips: [
      {
        en: 'After Send, a customer portal link may be available for that quote.',
        ar: 'بعد الإرسال قد يتوفر رابط بوابة العميل لذلك العرض.',
      },
    ],
    warnings: [
      {
        en: 'Add a Customer first if the empty state says so — quotations require a customer.',
        ar: 'أضف عميلاً أولاً إذا ظهرت رسالة فارغة — عروض الأسعار تتطلب عميلاً.',
      },
    ],
  },

  // —— Invoices ——
  {
    id: 'invoices-list',
    moduleId: 'invoices',
    title: { en: 'Customer invoices', ar: 'فواتير العملاء' },
    summary: {
      en: 'Create, track, and collect on invoices. Statuses include Draft, Unpaid, Partially paid, Paid, Overdue, Cancelled, Void.',
      ar: 'أنشئ الفواتير وتتبعها وحصّل عليها. الحالات تشمل مسودة، غير مدفوعة، مدفوعة جزئياً، مدفوعة، متأخرة، ملغاة، ملغاة نهائياً.',
    },
    href: '/app/invoices',
    steps: [
      {
        en: 'Invoices → Create Invoice (or Dashboard / Quick create).',
        ar: 'الفواتير ← إنشاء فاتورة (أو لوحة المعلومات / إنشاء سريع).',
      },
      {
        en: 'Choose customer, add inventory lines, taxes, save as draft or issue.',
        ar: 'اختر العميل، أضف بنود المخزون والضرائب، احفظ كمسودة أو أصدر.',
      },
      {
        en: 'Open an invoice to record payment (Cash, Card, Bank transfer, Wallet, Gift, Other).',
        ar: 'افتح فاتورة لتسجيل دفعة (نقد، بطاقة، تحويل بنكي، محفظة، هدية، أخرى).',
      },
      {
        en: 'Use search and status filters on the list; Refresh to reload.',
        ar: 'استخدم البحث وفلاتر الحالة في القائمة؛ حدّث لإعادة التحميل.',
      },
      {
        en: 'From detail: duplicate, cancel, void, delete draft, or email (needs mail config).',
        ar: 'من التفاصيل: نسخ، إلغاء، إبطال، حذف مسودة، أو إرسال بريد (يحتاج إعداد البريد).',
      },
    ],
    tips: [
      {
        en: 'Saudi workspaces may show Hijri dates and e-invoice / ZATCA status notes on the detail page.',
        ar: 'قد تعرض مساحات العمل السعودية التاريخ الهجري وملاحظات حالة الفاتورة الإلكترونية / ZATCA في صفحة التفاصيل.',
      },
    ],
    warnings: [
      {
        en: 'Payments are blocked for Paid, Cancelled, Void, or Draft invoices.',
        ar: 'لا يمكن تسجيل دفعات للفواتير المدفوعة أو الملغاة أو الملغاة نهائياً أو المسودات.',
      },
    ],
  },
  {
    id: 'pos-quick-sale',
    moduleId: 'invoices',
    title: { en: 'Quick Sale (POS)', ar: 'البيع السريع (نقطة البيع)' },
    summary: {
      en: 'Walk-in billing: pick customer (or Walk-in), tap products, charge Cash/Card/UPI/Wallet, print receipt.',
      ar: 'فوترة الحضور: اختر عميلاً (أو زائر)، اضغط المنتجات، حصّل نقد/بطاقة/UPI/محفظة، اطبع الإيصال.',
    },
    href: '/app/billing-pos',
    steps: [
      {
        en: 'Open from Invoices → Quick Sale, or go to /app/billing-pos.',
        ar: 'افتح من الفواتير ← بيع سريع، أو اذهب إلى البيع السريع.',
      },
      {
        en: 'New bill → select customer or Walk-in → add products (and variants if any).',
        ar: 'فاتورة جديدة ← اختر عميلاً أو زائر ← أضف منتجات (ومتغيرات إن وُجدت).',
      },
      {
        en: 'Adjust quantities, choose payment method, charge (or save as due).',
        ar: 'عدّل الكميات، اختر طريقة الدفع، حصّل (أو احفظ كمبلغ مستحق).',
      },
      {
        en: 'Print receipt if needed. Auto-print can be enabled under Settings → Printers.',
        ar: 'اطبع الإيصال عند الحاجة. يمكن تفعيل الطباعة التلقائية من الإعدادات ← الطابعات.',
      },
    ],
    tips: [
      {
        en: 'Stock decreases when lines are linked to inventory products.',
        ar: 'ينقص المخزون عندما تكون البنود مربوطة بمنتجات المخزون.',
      },
    ],
  },

  // —— Purchases ——
  {
    id: 'vendors',
    moduleId: 'purchases',
    title: { en: 'Vendors (suppliers)', ar: 'الموردون' },
    summary: {
      en: 'Supplier master list and a simple communication thread per vendor.',
      ar: 'قائمة الموردين وخيط تواصل بسيط لكل مورد.',
    },
    href: '/app/suppliers',
    steps: [
      {
        en: 'Sidebar Vendors → New supplier (name, email, phone) → Create supplier.',
        ar: 'القائمة ← الموردون ← مورد جديد (الاسم، البريد، الهاتف) ← إنشاء.',
      },
      {
        en: 'Select a supplier to view details and post messages on the communication thread.',
        ar: 'اختر مورداً لعرض التفاصيل ونشر رسائل في خيط التواصل.',
      },
    ],
    warnings: [
      {
        en: 'Creating suppliers usually needs procurement manage permission.',
        ar: 'إنشاء الموردين غالباً يحتاج صلاحية إدارة المشتريات.',
      },
    ],
  },
  {
    id: 'procurement',
    moduleId: 'purchases',
    title: { en: 'Purchases (procurement)', ar: 'المشتريات' },
    summary: {
      en: 'Purchase requests, purchase orders, approvals, and receiving goods into a warehouse.',
      ar: 'طلبات الشراء وأوامر الشراء والموافقات واستلام البضاعة في مستودع.',
    },
    href: '/app/procurement',
    steps: [
      {
        en: 'Purchases → Overview for KPIs (reorder items, open PRs/POs, active suppliers).',
        ar: 'المشتريات ← نظرة عامة للمؤشرات (أصناف إعادة الطلب، الطلبات/الأوامر المفتوحة، الموردون النشطون).',
      },
      {
        en: 'Purchase requests: New purchase request → Create → Submit → Approve (if you can approve).',
        ar: 'طلبات الشراء: طلب جديد ← إنشاء ← إرسال ← موافقة (إن كانت لديك صلاحية).',
      },
      {
        en: 'Purchase orders: New PO with supplier → Create → Approve → Receive all into a warehouse.',
        ar: 'أوامر الشراء: أمر جديد مع مورد ← إنشاء ← موافقة ← استلام الكل في مستودع.',
      },
      {
        en: 'Pending approvals tab: clear items waiting for your approval.',
        ar: 'تبويب الموافقات المعلقة: أنهِ العناصر التي تنتظر موافقتك.',
      },
    ],
    tips: [
      {
        en: 'Path: Vendor → Purchase order → Approve → Receive → Stock on hand rises.',
        ar: 'المسار: مورد ← أمر شراء ← موافقة ← استلام ← ترتفع الكمية المتوفرة.',
      },
    ],
    warnings: [
      {
        en: 'Add suppliers and warehouses before receiving stock.',
        ar: 'أضف الموردين والمستودعات قبل استلام المخزون.',
      },
    ],
  },

  // —— Inventory ——
  {
    id: 'inventory-overview',
    moduleId: 'inventory',
    title: { en: 'Inventory overview', ar: 'نظرة عامة على المخزون' },
    summary: {
      en: 'Four tabs: Stock (quantities), Products (catalog), Categories, Warehouses. They are different views of the same items — not three different databases.',
      ar: 'أربعة تبويبات: المخزون (الكميات)، المنتجات (الكتالوج)، التصنيفات، المستودعات. عروض مختلفة لنفس العناصر — وليست قواعد بيانات منفصلة.',
    },
    href: '/app/inventory',
    steps: [
      {
        en: 'Create Warehouses and Categories first.',
        ar: 'أنشئ المستودعات والتصنيفات أولاً.',
      },
      {
        en: 'Add Products (or Import CSV), then verify Stock levels.',
        ar: 'أضف المنتجات (أو استورد CSV)، ثم تحقق من مستويات المخزون.',
      },
    ],
  },
  {
    id: 'inventory-products-stock',
    moduleId: 'inventory',
    title: { en: 'Products tab vs Stock tab', ar: 'تبويب المنتجات مقابل تبويب المخزون' },
    summary: {
      en: 'You are not wrong if layouts differ. Products = what you sell. Stock = where quantity sits. CSV = flat create/update worksheet.',
      ar: 'لست مخطئاً إذا اختلفت التخطيطات. المنتجات = ما تبيعه. المخزون = أين تقع الكمية. CSV = ورقة إنشاء/تحديث مسطحة.',
    },
    href: '/app/inventory/products',
    steps: [
      {
        en: 'Products: SKU, Name, Type (Product/Service), Category, Barcode, Status, Price, Variants, Image.',
        ar: 'المنتجات: SKU، الاسم، النوع (منتج/خدمة)، التصنيف، الباركود، الحالة، السعر، المتغيرات، الصورة.',
      },
      {
        en: 'Stock: Location, On hand, Safety, Reorder, Unit price, Ext. value, Mfg/Exp dates, ABC, Scan, Status.',
        ar: 'المخزون: الموقع، المتاح، الأمان، إعادة الطلب، سعر الوحدة، القيمة الإجمالية، تواريخ التصنيع/الانتهاء، ABC، المسح، الحالة.',
      },
      {
        en: 'Services appear on Products but usually not as stock lines (no warehouse quantity).',
        ar: 'الخدمات تظهر في المنتجات وغالباً ليست كأسطر مخزون (بدون كمية مستودع).',
      },
    ],
    tips: [
      {
        en: 'Ext. value, Scan actions, and ABC are Stock-screen concepts — not CSV columns.',
        ar: 'القيمة الإجمالية وإجراءات المسح وABC مفاهيم شاشة المخزون — وليست أعمدة CSV.',
      },
    ],
  },
  {
    id: 'inventory-products',
    moduleId: 'inventory',
    title: { en: 'Create & edit products', ar: 'إنشاء وتعديل المنتجات' },
    summary: {
      en: 'Manual catalog entry with optional variants, opening stock, and batch/expiry tracking for physical products.',
      ar: 'إدخال يدوي للكتالوج مع متغيرات اختيارية ومخزون افتتاحي وتتبع دفعات/انتهاء للمنتجات المادية.',
    },
    href: '/app/inventory/products',
    steps: [
      {
        en: 'Inventory → Products → fill Name, Type, Selling price.',
        ar: 'المخزون ← المنتجات ← املأ الاسم والنوع وسعر البيع.',
      },
      {
        en: 'For products: optional Opening stock, warehouse (More options), batch/expiry checkbox.',
        ar: 'للمنتجات: مخزون افتتاحي اختياري، مستودع (المزيد من الخيارات)، خانة تواريخ التصنيع/الانتهاء.',
      },
      {
        en: 'Enable variants when one product has multiple SKUs/prices/stock levels.',
        ar: 'فعّل المتغيرات عندما يكون لمنتج واحد عدة رموز SKU/أسعار/مستويات مخزون.',
      },
      {
        en: 'Create product / Save changes. Use Barcode management for bulk barcode work.',
        ar: 'إنشاء منتج / حفظ التغييرات. استخدم إدارة الباركود للعمل الجماعي على الباركود.',
      },
    ],
  },
  {
    id: 'csv-import',
    moduleId: 'inventory',
    title: { en: 'Import products & services (CSV)', ar: 'استيراد المنتجات والخدمات (CSV)' },
    summary: {
      en: 'Fastest way to load a catalog. Download the official template, test 3–5 rows, then import the full file.',
      ar: 'أسرع طريقة لتحميل كتالوج. نزّل القالب الرسمي، جرّب 3–5 صفوف، ثم استورد الملف كاملاً.',
    },
    href: '/app/inventory/products',
    steps: [
      {
        en: 'Products → Import CSV → Download template (keep headers exactly).',
        ar: 'المنتجات ← استيراد CSV ← تنزيل القالب (أبقِ العناوين كما هي).',
      },
      {
        en: 'Set itemType = PRODUCT (stocked) or SERVICE (no stock).',
        ar: 'اضبط itemType = PRODUCT (مخزون) أو SERVICE (بدون مخزون).',
      },
      {
        en: 'For opening stock on products: warehouse + quantity (warehouse must exist, or enable Create missing warehouses).',
        ar: 'للمخزون الافتتاحي: warehouse + quantity (يجب أن يوجد المستودع، أو فعّل إنشاء المستودعات الناقصة).',
      },
      {
        en: 'Upload → fix validation errors → Import. Optional: Stage as Inactive until approved.',
        ar: 'ارفع ← صحّح أخطاء التحقق ← استورد. اختياري: حفظ كغير نشط حتى الموافقة.',
      },
      {
        en: 'Verify on Products, then Stock. Activate staged items by setting Status to Active.',
        ar: 'تحقق في المنتجات ثم المخزون. فعّل العناصر المرحّلة بتغيير الحالة إلى Active.',
      },
    ],
    tips: [
      {
        en: 'CSV → Products: sku, name, itemType, category, barcode, status, unitPrice.',
        ar: 'CSV ← المنتجات: sku، name، itemType، category، barcode، status، unitPrice.',
      },
      {
        en: 'CSV → Stock (PRODUCT): warehouse, quantity, reorderPoint, safetyStock.',
        ar: 'CSV ← المخزون (PRODUCT): warehouse، quantity، reorderPoint، safetyStock.',
      },
    ],
  },
  {
    id: 'inventory-stock',
    moduleId: 'inventory',
    title: { en: 'Stock desk', ar: 'مكتب المخزون' },
    summary: {
      en: 'Live quantities by location, replenishment, expiry filters, and optimization (ABC / slow-moving).',
      ar: 'كميات حية حسب الموقع، وإعادة التموين، وفلاتر الانتهاء، والتحسين (ABC / بطيء الحركة).',
    },
    href: '/app/inventory',
    steps: [
      {
        en: 'Inventory → Stock. Review Total SKUs, Below reorder, Critical SKUs, Locations.',
        ar: 'المخزون ← المخزون. راجع إجمالي الأصناف، تحت إعادة الطلب، الحرجة، المواقع.',
      },
      {
        en: 'Filter All stock / Expired / Expiring soon. Sort by name, price, or value.',
        ar: 'صفِّ الكل / منتهٍ / ينتهي قريباً. رتّب بالاسم أو السعر أو القيمة.',
      },
      {
        en: 'Add product / Edit SKU for on-hand, safety, reorder, price, ABC, velocity, dates.',
        ar: 'أضف منتجاً / عدّل SKU للكمية والأمان وإعادة الطلب والسعر وABC والسرعة والتواريخ.',
      },
      {
        en: 'Optimization tab: ABC analysis, cycle counting hints, slow-moving risk.',
        ar: 'تبويب التحسين: تحليل ABC، تلميحات الجرد الدوري، مخاطر بطء الحركة.',
      },
    ],
  },
  {
    id: 'inventory-masters',
    moduleId: 'inventory',
    title: { en: 'Categories & warehouses', ar: 'التصنيفات والمستودعات' },
    summary: {
      en: 'Master data that products and stock rows depend on.',
      ar: 'بيانات أساسية تعتمد عليها المنتجات وأسطر المخزون.',
    },
    href: '/app/inventory/categories',
    steps: [
      {
        en: 'Categories: New category → name/description → Create. Edit or delete when unused.',
        ar: 'التصنيفات: تصنيف جديد ← الاسم/الوصف ← إنشاء. عدّل أو احذف عند عدم الاستخدام.',
      },
      {
        en: 'Warehouses: New warehouse → name, optional code/location → Create. Toggle Active.',
        ar: 'المستودعات: مستودع جديد ← الاسم ورمز/موقع اختياري ← إنشاء. بدّل النشط.',
      },
    ],
  },

  // —— Customers ——
  {
    id: 'customers',
    moduleId: 'customers',
    title: {
      en: 'Customers, contacts, activities, notes',
      ar: 'العملاء وجهات الاتصال والأنشطة والملاحظات',
    },
    summary: {
      en: 'Everyone you sell to. Sections: customers, contacts, activities, notes.',
      ar: 'كل من تبيع له. الأقسام: العملاء، جهات الاتصال، الأنشطة، الملاحظات.',
    },
    href: '/app/customers',
    steps: [
      {
        en: 'Customers → New customer (company, email, phone, country, status) → save.',
        ar: 'العملاء ← عميل جديد (الشركة، البريد، الهاتف، الدولة، الحالة) ← حفظ.',
      },
      {
        en: 'Add contacts under the customer. Log activities and mark Complete/Cancel.',
        ar: 'أضف جهات اتصال تحت العميل. سجّل أنشطة وعلّمها مكتملة/ملغاة.',
      },
      {
        en: 'Keep notes for internal context. Archive/Delete/Restore customers as needed.',
        ar: 'احتفظ بملاحظات للسياق الداخلي. أرشف/احذف/استعد العملاء حسب الحاجة.',
      },
    ],
    tips: [
      {
        en: 'Create customers before quotations and most invoices.',
        ar: 'أنشئ العملاء قبل عروض الأسعار ومعظم الفواتير.',
      },
    ],
  },

  // —— Accounting ——
  {
    id: 'accounting',
    moduleId: 'accounting',
    title: { en: 'Accounting workspace', ar: 'مساحة المحاسبة' },
    summary: {
      en: 'Cashbook, receivables, payables, journals, bank feeds view, and reporting CSV packs.',
      ar: 'دفتر النقدية والمستحقات والدائنون والقيود وعرض التغذية البنكية وحزم تقارير CSV.',
    },
    href: '/app/accounting',
    steps: [
      {
        en: 'Open Accounting. Pick a lens if shown (Controller / AP workspace / Audit).',
        ar: 'افتح المحاسبة. اختر عدسة إن ظهرت (مراقب / مساحة الدائنون / تدقيق).',
      },
      {
        en: 'Read KPI cards: Cashbook, OpEx, Receivables, Payables — drill down when available.',
        ar: 'اقرأ المؤشرات: دفتر النقدية، المصروفات، المستحقات، الدائنون — وتعمّق عند الإتاحة.',
      },
      {
        en: 'Tabs: Control tower, AR/AP, Journal & audit, Bank feeds, Reporting suite.',
        ar: 'التبويبات: برج التحكم، AR/AP، القيود والتدقيق، التغذية البنكية، مجموعة التقارير.',
      },
      {
        en: 'Reporting suite: download Balance sheet, P&L, Trial balance, or Consolidation CSV.',
        ar: 'مجموعة التقارير: نزّل الميزانية أو الربح والخسارة أو ميزان المراجعة أو CSV التوحيد.',
      },
    ],
  },

  // —— HR ——
  {
    id: 'hr-hub',
    moduleId: 'hr',
    title: { en: 'HR & Payroll hub', ar: 'مركز الموارد البشرية والرواتب' },
    summary: {
      en: 'Employees, leave, attendance, and payroll. Departments are managed under Settings → Workspace admin.',
      ar: 'الموظفون والإجازات والحضور والرواتب. الأقسام تُدار من الإعدادات ← إدارة مساحة العمل.',
    },
    href: '/app/hr',
    steps: [
      {
        en: 'HR & Payroll → open Employees / Leave / Attendance / Payroll cards.',
        ar: 'الموارد البشرية والرواتب ← افتح بطاقات الموظفين / الإجازات / الحضور / الرواتب.',
      },
    ],
  },
  {
    id: 'hr-employees',
    moduleId: 'hr',
    title: { en: 'Employees', ar: 'الموظفون' },
    summary: {
      en: 'Hire roster: add, search, and remove employee records.',
      ar: 'سجل التوظيف: أضف وابحث واحذف سجلات الموظفين.',
    },
    href: '/app/hr/employees',
    steps: [
      {
        en: 'HR → Employees → Add employee → fill details → save.',
        ar: 'الموارد البشرية ← الموظفون ← إضافة موظف ← املأ التفاصيل ← حفظ.',
      },
      {
        en: 'Search the list; delete only when appropriate for your policy.',
        ar: 'ابحث في القائمة؛ احذف فقط بما يناسب سياستك.',
      },
    ],
  },
  {
    id: 'hr-leave-attendance',
    moduleId: 'hr',
    title: { en: 'Leave & attendance', ar: 'الإجازات والحضور' },
    summary: {
      en: 'Leave types and requests with approve/reject; check-in/out attendance for the last two weeks.',
      ar: 'أنواع الإجازات والطلبات مع موافقة/رفض؛ حضور دخول/خروج لآخر أسبوعين.',
    },
    href: '/app/hr/leave',
    steps: [
      {
        en: 'Leave: manage leave types → New leave request → Approve or Reject.',
        ar: 'الإجازات: أدر أنواع الإجازة ← طلب جديد ← موافقة أو رفض.',
      },
      {
        en: 'Attendance: select employee → Check in / out → review recent records.',
        ar: 'الحضور: اختر موظفاً ← دخول / خروج ← راجع السجلات الأخيرة.',
      },
    ],
  },
  {
    id: 'hr-payroll',
    moduleId: 'hr',
    title: { en: 'Payroll runs', ar: 'تشغيل الرواتب' },
    summary: {
      en: 'Create a payroll run, process drafts, open payslips, download PDF.',
      ar: 'أنشئ تشغيل رواتب، عالج المسودات، افتح قسائم الراتب، نزّل PDF.',
    },
    href: '/app/hr/payroll',
    steps: [
      {
        en: 'HR → Payroll → New payroll run → Create run.',
        ar: 'الموارد البشرية ← الرواتب ← تشغيل جديد ← إنشاء.',
      },
      {
        en: 'Process when status is Draft. Expand payslips → Download PDF.',
        ar: 'عالج عندما تكون الحالة مسودة. وسّع قسائم الراتب ← تنزيل PDF.',
      },
    ],
    warnings: [
      {
        en: 'HR write permission is required for create/process actions.',
        ar: 'صلاحية كتابة الموارد البشرية مطلوبة لإجراءات الإنشاء/المعالجة.',
      },
    ],
  },

  // —— Reports ——
  {
    id: 'reports',
    moduleId: 'reports',
    title: { en: 'Reports', ar: 'التقارير' },
    summary: {
      en: 'Plain-language sales, purchases, profit, tax, and low-stock summaries with period filter and CSV export.',
      ar: 'ملخصات بلغة واضحة للمبيعات والمشتريات والربح والضريبة والمخزون المنخفض مع فلتر فترة وتصدير CSV.',
    },
    href: '/app/reports',
    steps: [
      {
        en: 'Reports → pick period → review Total Sales, Purchases, Pending Payments, Low Stock, Tax.',
        ar: 'التقارير ← اختر الفترة ← راجع إجمالي المبيعات والمشتريات والمدفوعات المعلقة والمخزون المنخفض والضريبة.',
      },
      {
        en: 'Export CSV when you need a spreadsheet for owners or auditors.',
        ar: 'صدّر CSV عندما تحتاج جدولاً للملاك أو المراجعين.',
      },
    ],
  },
  {
    id: 'alerts',
    moduleId: 'reports',
    title: { en: 'Alerts & notifications', ar: 'التنبيهات والإشعارات' },
    summary: {
      en: 'Workspace activity feed. Open from the bell or Alerts page; mark read individually or all at once.',
      ar: 'سجل نشاط مساحة العمل. افتح من الجرس أو صفحة التنبيهات؛ علّم مقروءاً فردياً أو للكل.',
    },
    href: '/app/alerts',
    steps: [
      {
        en: 'Click the bell → View All Notifications, or open /app/alerts.',
        ar: 'اضغط الجرس ← عرض كل التنبيهات، أو افتح صفحة التنبيهات.',
      },
      {
        en: 'Mark read / Mark all read to clear the badge.',
        ar: 'علّم مقروءاً / علّم الكل مقروءاً لمسح الشارة.',
      },
    ],
  },
  {
    id: 'documents-branches',
    moduleId: 'reports',
    title: { en: 'Documents & branches', ar: 'المستندات والفروع' },
    summary: {
      en: 'File vault for workspace documents. Branches represent store/office locations (often linked to warehouses) and ops views.',
      ar: 'خزنة ملفات لمستندات مساحة العمل. الفروع تمثل مواقع المتاجر/المكاتب (غالباً مربوطة بالمستودعات) وعروض التشغيل.',
    },
    href: '/app/documents',
    steps: [
      {
        en: 'Documents: Upload file to register documents in the vault.',
        ar: 'المستندات: ارفع ملفاً لتسجيله في الخزنة.',
      },
      {
        en: 'Branches: create/edit branch locations, review stock lines and tasks, jump to POS when needed.',
        ar: 'الفروع: أنشئ/عدّل مواقع الفروع، راجع أسطر المخزون والمهام، وانتقل لنقطة البيع عند الحاجة.',
      },
    ],
    tips: [
      {
        en: 'These pages may not sit on the main sidebar — open via search, links, or URL.',
        ar: 'قد لا تظهر هذه الصفحات في القائمة الرئيسية — افتحها عبر البحث أو الروابط أو الرابط المباشر.',
      },
    ],
  },

  // —— Settings ——
  {
    id: 'settings-general',
    moduleId: 'settings',
    title: { en: 'Settings (profile & preferences)', ar: 'الإعدادات (الملف والتفضيلات)' },
    summary: {
      en: 'General preferences, business localization, printers, my profile, security, and email preferences.',
      ar: 'التفضيلات العامة وتعريب الأعمال والطابعات وملفي والأمان وتفضيلات البريد.',
    },
    href: '/app/settings',
    steps: [
      {
        en: 'General: low stock email alerts, daily summary, dark mode, and related toggles.',
        ar: 'عام: تنبيهات بريد المخزون المنخفض، الملخص اليومي، الوضع الداكن، والتبديلات ذات الصلة.',
      },
      {
        en: 'Business localization: country, currency, timezone (owners save workspace defaults).',
        ar: 'تعريب الأعمال: الدولة، العملة، المنطقة الزمنية (الملاك يحفظون افتراضيات مساحة العمل).',
      },
      {
        en: 'Printers: receipt format, auto-print on charge, test print for POS.',
        ar: 'الطابعات: تنسيق الإيصال، طباعة تلقائية عند التحصيل، طباعة تجريبية لنقطة البيع.',
      },
      {
        en: 'My profile / Security / Email: update identity, password/security, and mail prefs.',
        ar: 'ملفي / الأمان / البريد: حدّث الهوية وكلمة المرور/الأمان وتفضيلات البريد.',
      },
    ],
  },
  {
    id: 'settings-billing',
    moduleId: 'settings',
    title: { en: 'Subscription & billing', ar: 'الاشتراك والفوترة' },
    summary: {
      en: 'Plan changes, payments, invoices for your Velon subscription. Owners/admins only.',
      ar: 'تغيير الباقة والمدفوعات وفواتير اشتراك Velon. للمالك/المديرين فقط.',
    },
    href: '/app/settings/billing',
    steps: [
      {
        en: 'Settings → Subscription & billing (or /app/settings/billing).',
        ar: 'الإعدادات ← الاشتراك والفوترة.',
      },
      {
        en: 'Review plan, pay outstanding amounts, download billing invoices, cancel/resume if available.',
        ar: 'راجع الباقة، ادفع المستحقات، نزّل فواتير الاشتراك، ألغِ/استعد إن أتيح.',
      },
    ],
    warnings: [
      {
        en: 'Non-admins see access denied and should ask the workspace owner.',
        ar: 'غير المديرين يرون رفض الوصول ويجب طلب المالك.',
      },
    ],
  },
  {
    id: 'settings-admin',
    moduleId: 'settings',
    title: {
      en: 'Workspace admin (users & company)',
      ar: 'إدارة مساحة العمل (المستخدمون والشركة)',
    },
    summary: {
      en: 'Company profile, users, departments, seats, invitations, security, and audit — for owners/admins.',
      ar: 'ملف الشركة والمستخدمون والأقسام والمقاعد والدعوات والأمان والتدقيق — للمالك/المديرين.',
    },
    href: '/app/settings/admin',
    steps: [
      {
        en: 'Open Workspace administration from Settings shortcuts.',
        ar: 'افتح إدارة مساحة العمل من اختصارات الإعدادات.',
      },
      {
        en: 'Company / workspace: legal name, Saudi CR/VAT/address fields when relevant.',
        ar: 'الشركة / مساحة العمل: الاسم النظامي وحقول السجل/الضريبة/العنوان عند الحاجة.',
      },
      {
        en: 'Users & invitations: invite with role presets; manage seats/licensing.',
        ar: 'المستخدمون والدعوات: ادعُ بإعدادات أدوار؛ أدر المقاعد/التراخيص.',
      },
      {
        en: 'Departments: organize teams (also linked from HR hub).',
        ar: 'الأقسام: نظّم الفرق (مرتبطة أيضاً من مركز الموارد البشرية).',
      },
      {
        en: 'Security & audit: review access and recent admin activity.',
        ar: 'الأمان والتدقيق: راجع الوصول ونشاط الإدارة الأخير.',
      },
    ],
  },
];

/** Kept for import-dialog / mapping table compatibility. */
export const CSV_TO_UI_MAP = [
  { csv: 'sku', products: { en: 'SKU', ar: 'رمز SKU' }, stock: { en: 'SKU', ar: 'رمز SKU' } },
  {
    csv: 'name',
    products: { en: 'Name', ar: 'الاسم' },
    stock: { en: 'Product', ar: 'المنتج' },
  },
  {
    csv: 'itemType',
    products: { en: 'Type', ar: 'النوع' },
    stock: { en: '—', ar: '—' },
  },
  {
    csv: 'category',
    products: { en: 'Category', ar: 'التصنيف' },
    stock: { en: '—', ar: '—' },
  },
  {
    csv: 'barcode',
    products: { en: 'Barcode', ar: 'الباركود' },
    stock: { en: 'Scan-related', ar: 'مرتبط بالمسح' },
  },
  {
    csv: 'status',
    products: { en: 'Status', ar: 'الحالة' },
    stock: { en: 'Status', ar: 'الحالة' },
  },
  {
    csv: 'unitPrice',
    products: { en: 'Price', ar: 'السعر' },
    stock: { en: 'Unit price', ar: 'سعر الوحدة' },
  },
  {
    csv: 'warehouse',
    products: { en: '— (opening only)', ar: '— (افتتاحي فقط)' },
    stock: { en: 'Location', ar: 'الموقع' },
  },
  {
    csv: 'quantity',
    products: { en: '— (opening only)', ar: '— (افتتاحي فقط)' },
    stock: { en: 'On hand', ar: 'المتاح' },
  },
  {
    csv: 'reorderPoint',
    products: { en: '—', ar: '—' },
    stock: { en: 'Reorder', ar: 'إعادة الطلب' },
  },
  {
    csv: 'safetyStock',
    products: { en: '—', ar: '—' },
    stock: { en: 'Safety', ar: 'الأمان' },
  },
] as const;

/** @deprecated Use USER_GUIDE_TOPICS — kept so older imports do not break mid-refactor. */
export const USER_GUIDE_SECTIONS = USER_GUIDE_TOPICS.map((topic) => ({
  id: topic.id,
  title: topic.title.en,
  summary: topic.summary.en,
  steps: topic.steps?.map((s) => s.en),
  tips: topic.tips?.map((s) => s.en),
}));
