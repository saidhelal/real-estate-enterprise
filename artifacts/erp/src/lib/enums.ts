export type Lang = "en" | "ar";

export const ENUM_LABELS: Record<string, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "نقدي" },
  bank_transfer: { en: "Bank Transfer", ar: "تحويل بنكي" },
  cheque: { en: "Cheque", ar: "شيك" },
  card: { en: "Card", ar: "بطاقة" },
  active: { en: "Active", ar: "نشط" },
  inactive: { en: "Inactive", ar: "غير نشط" },
  closed: { en: "Closed", ar: "مغلق" },
  converted: { en: "Converted", ar: "محوّل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  expired: { en: "Expired", ar: "منتهي" },
  pending: { en: "Pending", ar: "قيد الانتظار" },
  paid: { en: "Paid", ar: "مدفوع" },
  partial: { en: "Partial", ar: "جزئي" },
  overdue: { en: "Overdue", ar: "متأخر" },
  waived: { en: "Waived", ar: "معفى" },
  confirmed: { en: "Confirmed", ar: "مؤكد" },
  done: { en: "Done", ar: "منجز" },
  individual: { en: "Individual", ar: "فرد" },
  company: { en: "Company", ar: "شركة" },
  fixed: { en: "Fixed", ar: "ثابت" },
  percentage: { en: "Percentage", ar: "نسبة مئوية" },
  in: { en: "In", ar: "وارد" },
  out: { en: "Out", ar: "صادر" },
  planning: { en: "Planning", ar: "تخطيط" },
  completed: { en: "Completed", ar: "مكتمل" },
  on_hold: { en: "On Hold", ar: "معلّق" },
  draft: { en: "Draft", ar: "مسودة" },
  new: { en: "New", ar: "جديد" },
  contacted: { en: "Contacted", ar: "تم التواصل" },
  qualified: { en: "Qualified", ar: "مؤهل" },
  proposal: { en: "Proposal", ar: "عرض" },
  won: { en: "Won", ar: "ناجح" },
  lost: { en: "Lost", ar: "خاسر" },
  monthly: { en: "Monthly", ar: "شهري" },
  quarterly: { en: "Quarterly", ar: "ربع سنوي" },
  semi_annual: { en: "Semi Annual", ar: "نصف سنوي" },
  annual: { en: "Annual", ar: "سنوي" },
  custom: { en: "Custom", ar: "مخصص" },
  note: { en: "Note", ar: "ملاحظة" },
  call: { en: "Call", ar: "اتصال" },
  meeting: { en: "Meeting", ar: "اجتماع" },
  email: { en: "Email", ar: "بريد إلكتروني" },
  visit: { en: "Visit", ar: "زيارة" },
  // accounting: account types
  asset: { en: "Asset", ar: "أصول" },
  liability: { en: "Liability", ar: "التزامات" },
  equity: { en: "Equity", ar: "حقوق ملكية" },
  revenue: { en: "Revenue", ar: "إيرادات" },
  expense: { en: "Expense", ar: "مصروفات" },
  // accounting: normal side
  debit: { en: "Debit", ar: "مدين" },
  credit: { en: "Credit", ar: "دائن" },
  // accounting: journal entry status
  posted: { en: "Posted", ar: "مرحّل" },
  reversed: { en: "Reversed", ar: "معكوس" },
  approved: { en: "Approved", ar: "معتمد" },
  // accounting: cost center kind
  department: { en: "Department", ar: "قسم" },
  project: { en: "Project", ar: "مشروع" },
  branch: { en: "Branch", ar: "فرع" },
  // accounting: fiscal period / budget status
  open: { en: "Open", ar: "مفتوح" },
};

export function enumLabel(value: string | null | undefined, lang: Lang): string {
  if (!value) return "-";
  const entry = ENUM_LABELS[value];
  return entry ? entry[lang] : value;
}

export interface EnumOption {
  value: string;
  label: string;
  labelAr: string;
}

export function enumOptions(values: string[]): EnumOption[] {
  return values.map((v) => {
    const e = ENUM_LABELS[v];
    return { value: v, label: e?.en ?? v, labelAr: e?.ar ?? v };
  });
}
