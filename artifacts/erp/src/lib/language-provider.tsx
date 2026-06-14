import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "en" | "ar";

type LanguageProviderProps = {
  children: React.ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
};

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
    "login.subtitle": "Enter your credentials to access the ERP.",
    "login.username": "Username",
    "login.password": "Password",
    "login.submit": "Sign In",
    "nav.dashboard": "Dashboard",
    "nav.users": "Users",
    "nav.roles": "Roles",
    "nav.companies": "Companies",
    "nav.branches": "Branches",
    "nav.fiscal_years": "Fiscal Years",
    "nav.currencies": "Currencies",
    "nav.number_sequences": "Number Sequences",
    "nav.audit_logs": "Audit Logs",
    "nav.login_history": "Login History",
    "nav.settings": "Settings",
    "nav.change_password": "Change Password",
    "nav.logout": "Logout",
    "dashboard.title": "Dashboard",
    "dashboard.welcome": "Welcome",
    "dashboard.users": "Users",
    "dashboard.companies": "Companies",
    "dashboard.branches": "Branches",
    "dashboard.roles": "Roles",
    "dashboard.active_sessions": "Active Sessions",
    "dashboard.fiscal_years": "Fiscal Years",
    "dashboard.currencies": "Currencies",
    "dashboard.audit_events": "Audit Events",
    "dashboard.recent_activity": "Recent Activity",
    "common.actions": "Actions",
    "common.create": "Create",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.search": "Search...",
    "common.status": "Status",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.locked": "Locked",
    "common.open": "Open",
    "common.closed": "Closed",
    "users.title": "Users",
    "users.create": "Create User",
    "users.edit": "Edit User",
    "users.delete_confirm": "Are you sure you want to delete this user?",
    "roles.title": "Roles",
    "roles.create": "Create Role",
    "companies.title": "Companies",
    "companies.create": "Create Company",
    "branches.title": "Branches",
    "branches.create": "Create Branch",
    "fiscal_years.title": "Fiscal Years",
    "fiscal_years.create": "Create Fiscal Year",
    "currencies.title": "Currencies",
    "currencies.create": "Create Currency",
    "number_sequences.title": "Number Sequences",
    "number_sequences.create": "Create Number Sequence",
    "audit_logs.title": "Audit Logs",
    "login_history.title": "Login History",
    "settings.title": "Settings",
    "change_password.title": "Change Password",
    "change_password.current": "Current Password",
    "change_password.new": "New Password",
    "change_password.confirm": "Confirm New Password",
    "change_password.submit": "Change Password",
    "change_password.success": "Password changed successfully",
    "change_password.error": "Failed to change password",
  },
  ar: {
    "login.title": "تسجيل الدخول",
    "login.subtitle": "أدخل بيانات الاعتماد الخاصة بك للوصول.",
    "login.username": "اسم المستخدم",
    "login.password": "كلمة المرور",
    "login.submit": "تسجيل الدخول",
    "nav.dashboard": "لوحة القيادة",
    "nav.users": "المستخدمين",
    "nav.roles": "الأدوار",
    "nav.companies": "الشركات",
    "nav.branches": "الفروع",
    "nav.fiscal_years": "السنوات المالية",
    "nav.currencies": "العملات",
    "nav.number_sequences": "التسلسلات الرقمية",
    "nav.audit_logs": "سجلات التدقيق",
    "nav.login_history": "سجل تسجيل الدخول",
    "nav.settings": "الإعدادات",
    "nav.change_password": "تغيير كلمة المرور",
    "nav.logout": "تسجيل الخروج",
    "dashboard.title": "لوحة القيادة",
    "dashboard.welcome": "مرحباً",
    "dashboard.users": "المستخدمين",
    "dashboard.companies": "الشركات",
    "dashboard.branches": "الفروع",
    "dashboard.roles": "الأدوار",
    "dashboard.active_sessions": "الجلسات النشطة",
    "dashboard.fiscal_years": "السنوات المالية",
    "dashboard.currencies": "العملات",
    "dashboard.audit_events": "أحداث التدقيق",
    "dashboard.recent_activity": "النشاط الأخير",
    "common.actions": "الإجراءات",
    "common.create": "إنشاء",
    "common.edit": "تعديل",
    "common.delete": "حذف",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.search": "بحث...",
    "common.status": "الحالة",
    "common.active": "نشط",
    "common.inactive": "غير نشط",
    "common.locked": "مغلق",
    "common.open": "مفتوح",
    "common.closed": "مغلق",
    "users.title": "المستخدمين",
    "users.create": "إنشاء مستخدم",
    "users.edit": "تعديل مستخدم",
    "users.delete_confirm": "هل أنت متأكد أنك تريد حذف هذا المستخدم؟",
    "roles.title": "الأدوار",
    "roles.create": "إنشاء دور",
    "companies.title": "الشركات",
    "companies.create": "إنشاء شركة",
    "branches.title": "الفروع",
    "branches.create": "إنشاء فرع",
    "fiscal_years.title": "السنوات المالية",
    "fiscal_years.create": "إنشاء سنة مالية",
    "currencies.title": "العملات",
    "currencies.create": "إنشاء عملة",
    "number_sequences.title": "التسلسلات الرقمية",
    "number_sequences.create": "إنشاء تسلسل رقمي",
    "audit_logs.title": "سجلات التدقيق",
    "login_history.title": "سجل تسجيل الدخول",
    "settings.title": "الإعدادات",
    "change_password.title": "تغيير كلمة المرور",
    "change_password.current": "كلمة المرور الحالية",
    "change_password.new": "كلمة المرور الجديدة",
    "change_password.confirm": "تأكيد كلمة المرور الجديدة",
    "change_password.submit": "تغيير كلمة المرور",
    "change_password.success": "تم تغيير كلمة المرور بنجاح",
    "change_password.error": "فشل في تغيير كلمة المرور",
  },
};

export function LanguageProvider({
  children,
  defaultLanguage = "en",
  storageKey = "erp-language",
  ...props
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem(storageKey) as Language) || defaultLanguage
  );

  const dir = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  const setLanguage = (lang: Language) => {
    localStorage.setItem(storageKey, lang);
    setLanguageState(lang);
  };

  const t = (key: string) => translations[language]?.[key] || key;

  return (
    <LanguageProviderContext.Provider {...props} value={{ language, setLanguage, dir, t }}>
      {children}
    </LanguageProviderContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageProviderContext);
  if (context === undefined)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};
