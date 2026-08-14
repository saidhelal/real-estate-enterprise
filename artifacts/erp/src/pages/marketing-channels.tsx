import {
  useListMarketingChannels,
  useCreateMarketingChannel,
  useUpdateMarketingChannel,
  useDeleteMarketingChannel,
  getListMarketingChannelsQueryKey,
  useListCompanies,
  type MarketingChannel,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { type EnumOption } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

const CHANNEL_TYPES: EnumOption[] = [
  { value: "digital", label: "Digital", labelAr: "رقمي" },
  { value: "social_media", label: "Social Media", labelAr: "وسائل التواصل" },
  { value: "search_engine", label: "Search Engine", labelAr: "محرك بحث" },
  { value: "website", label: "Website", labelAr: "موقع إلكتروني" },
  { value: "print", label: "Print", labelAr: "مطبوع" },
  { value: "outdoor", label: "Outdoor", labelAr: "خارجي" },
  { value: "email", label: "Email", labelAr: "بريد إلكتروني" },
  { value: "sms", label: "SMS", labelAr: "رسائل نصية" },
  { value: "event", label: "Event", labelAr: "فعالية" },
  { value: "referral", label: "Referral", labelAr: "إحالة" },
];

function optLabel(opts: EnumOption[], value: string | null | undefined, lang: "en" | "ar"): string {
  if (!value) return "-";
  const o = opts.find((x) => x.value === value);
  return o ? (lang === "ar" ? o.labelAr : o.label) : value;
}

export default function MarketingChannelsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "marketingChannel",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", rtl: true },
    { name: "channelType", label: "Type", labelAr: "النوع", type: "select", options: CHANNEL_TYPES },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<MarketingChannel>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr ?? r.name : r.name) },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{optLabel(CHANNEL_TYPES, r.channelType, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Marketing Channels"
      titleAr="القنوات التسويقية"
      columns={columns}
      fields={fields}
      useList={useListMarketingChannels}
      useCreate={useCreateMarketingChannel}
      useUpdate={useUpdateMarketingChannel}
      useDelete={useDeleteMarketingChannel}
      getListQueryKey={getListMarketingChannelsQueryKey}
      companyId={companyId}
    />
  );
}
