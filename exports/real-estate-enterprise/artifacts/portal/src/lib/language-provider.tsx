import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "en" | "ar";

type LanguageProviderState = {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
};

const initialState: LanguageProviderState = {
  language: "en",
  setLanguage: () => null,
  dir: "ltr",
  t: (key) => key,
};

const LanguageProviderContext = createContext<LanguageProviderState>(initialState);

const translations: Record<Language, Record<string, string>> = {
  en: {
    "login.title": "Sign In",
    "login.subtitle": "Access your customer portal",
    "login.username": "Username",
    "login.password": "Password",
    "login.submit": "Sign In",
    "login.forgot": "Forgot Password?",
    
    "nav.dashboard": "Dashboard",
    "nav.units": "My Units",
    "nav.contracts": "Contracts",
    "nav.installments": "Installment Schedule",
    "nav.collections": "Payment History",
    "nav.documents": "Documents",
    "nav.maintenance": "Maintenance",
    "nav.complaints": "Complaints",
    "nav.support": "Support Tickets",
    "nav.notifications": "Notifications",
    "nav.logout": "Sign Out",
    
    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.create": "Create",
    "common.actions": "Actions",
    "common.status": "Status",
    "common.date": "Date",
    
    "dash.welcome": "Welcome back",
    "dash.total_value": "Total Investment",
    "dash.paid": "Amount Paid",
    "dash.outstanding": "Outstanding Balance",
    "dash.overdue": "Overdue Amount",
    "dash.next_payment": "Next Payment",
    "dash.units_count": "Owned Units",
    
    "units.title": "My Units",
    "units.project": "Project",
    "units.area": "Area",
    "units.price": "Price",
    
    "contracts.title": "My Contracts",
    
    "installments.title": "Installment Schedule",
    "installments.due_date": "Due Date",
    "installments.amount": "Amount",
    "installments.paid": "Paid",
    
    "collections.title": "Payment History",
    
    "documents.title": "Document Center",
    
    "maintenance.title": "Maintenance Requests",
    "maintenance.create": "New Request",
    "maintenance.subject": "Subject",
    
    "complaints.title": "Complaints",
    "complaints.create": "New Complaint",
    
    "support.title": "Support Tickets",
    "support.create": "New Ticket"
  },
  ar: {
    "login.title": "تسجيل الدخول",
    "login.subtitle": "الدخول إلى بوابة العملاء",
    "login.username": "اسم المستخدم",
    "login.password": "كلمة المرور",
    "login.submit": "تسجيل الدخول",
    "login.forgot": "نسيت كلمة المرور؟",
    
    "nav.dashboard": "لوحة القيادة",
    "nav.units": "وحداتي",
    "nav.contracts": "العقود",
    "nav.installments": "جدول الأقساط",
    "nav.collections": "سجل الدفعات",
    "nav.documents": "المستندات",
    "nav.maintenance": "طلبات الصيانة",
    "nav.complaints": "الشكاوى",
    "nav.support": "تذاكر الدعم",
    "nav.notifications": "الإشعارات",
    "nav.logout": "تسجيل الخروج",
    
    "common.loading": "جاري التحميل...",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.create": "إنشاء",
    "common.actions": "الإجراءات",
    "common.status": "الحالة",
    "common.date": "التاريخ",
    
    "dash.welcome": "مرحباً بك",
    "dash.total_value": "إجمالي الاستثمار",
    "dash.paid": "المبلغ المدفوع",
    "dash.outstanding": "الرصيد المتبقي",
    "dash.overdue": "المبلغ المتأخر",
    "dash.next_payment": "الدفعة القادمة",
    "dash.units_count": "الوحدات المملوكة",
    
    "units.title": "وحداتي",
    "units.project": "المشروع",
    "units.area": "المساحة",
    "units.price": "السعر",
    
    "contracts.title": "العقود",
    
    "installments.title": "جدول الأقساط",
    "installments.due_date": "تاريخ الاستحقاق",
    "installments.amount": "المبلغ",
    "installments.paid": "المدفوع",
    
    "collections.title": "سجل الدفعات",
    
    "documents.title": "المستندات",
    
    "maintenance.title": "طلبات الصيانة",
    "maintenance.create": "طلب جديد",
    "maintenance.subject": "الموضوع",
    
    "complaints.title": "الشكاوى",
    "complaints.create": "شكوى جديدة",
    
    "support.title": "تذاكر الدعم",
    "support.create": "تذكرة جديدة"
  }
};

export function LanguageProvider({
  children,
  defaultLanguage = "en",
  storageKey = "portal-language",
}: {
  children: React.ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
}) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem(storageKey) as Language) || defaultLanguage;
  });

  const dir = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  const setLanguage = (lang: Language) => {
    localStorage.setItem(storageKey, lang);
    setLanguageState(lang);
  };

  const t = (key: string) => {
    const text = translations[language][key] || translations["en"][key] || key;
    return text;
  };

  return (
    <LanguageProviderContext.Provider value={{ language, setLanguage, dir, t }}>
      {children}
    </LanguageProviderContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageProviderContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
