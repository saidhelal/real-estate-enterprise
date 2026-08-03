import {
  useListMarketingCampaigns,
  useCreateMarketingCampaign,
  useUpdateMarketingCampaign,
  useDeleteMarketingCampaign,
  getListMarketingCampaignsQueryKey,
  useListCompanies,
  type MarketingCampaign,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { type EnumOption } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

const CAMPAIGN_TYPES: EnumOption[] = [
  { value: "digital", label: "Digital", labelAr: "رقمي" },
  { value: "social_media", label: "Social Media", labelAr: "وسائل التواصل" },
  { value: "print", label: "Print", labelAr: "مطبوع" },
  { value: "outdoor", label: "Outdoor", labelAr: "خارجي" },
  { value: "email", label: "Email", labelAr: "بريد إلكتروني" },
  { value: "sms", label: "SMS", labelAr: "رسائل نصية" },
  { value: "event", label: "Event", labelAr: "فعالية" },
  { value: "referral", label: "Referral", labelAr: "إحالة" },
  { value: "tv_radio", label: "TV / Radio", labelAr: "تلفزيون / إذاعة" },
];

const CAMPAIGN_STATUSES: EnumOption[] = [
  { value: "draft", label: "Draft", labelAr: "مسودة" },
  { value: "active", label: "Active", labelAr: "نشطة" },
  { value: "paused", label: "Paused", labelAr: "متوقفة مؤقتاً" },
  { value: "completed", label: "Completed", labelAr: "مكتملة" },
  { value: "cancelled", label: "Cancelled", labelAr: "ملغاة" },
];

function optLabel(opts: EnumOption[], value: string | null | undefined, lang: "en" | "ar"): string {
  if (!value) return "-";
  const o = opts.find((x) => x.value === value);
  return o ? (lang === "ar" ? o.labelAr : o.label) : value;
}

export default function MarketingCampaignsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code (auto)", labelAr: "الرمز (تلقائي)", createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "campaignType", label: "Type", labelAr: "النوع", type: "select", options: CAMPAIGN_TYPES },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: CAMPAIGN_STATUSES },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "budget", label: "Budget", labelAr: "الميزانية", type: "money" },
    { name: "actualCost", label: "Actual Cost", labelAr: "التكلفة الفعلية", type: "money" },
    { name: "ownerUserId", label: "Owner (User ID)", labelAr: "المسؤول (معرّف المستخدم)" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<MarketingCampaign>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => r.name },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{optLabel(CAMPAIGN_TYPES, r.campaignType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{optLabel(CAMPAIGN_STATUSES, r.status, language)}</Badge> },
    { header: "Budget", headerAr: "الميزانية", render: (r) => r.budget ?? "-" },
  ];

  return (
    <ResourceManager
      title="Marketing Campaigns"
      titleAr="الحملات التسويقية"
      columns={columns}
      fields={fields}
      useList={useListMarketingCampaigns}
      useCreate={useCreateMarketingCampaign}
      useUpdate={useUpdateMarketingCampaign}
      useDelete={useDeleteMarketingCampaign}
      getListQueryKey={getListMarketingCampaignsQueryKey}
      companyId={companyId}
    />
  );
}
