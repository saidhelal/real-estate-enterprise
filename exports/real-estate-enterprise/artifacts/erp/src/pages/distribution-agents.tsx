import {
  useListMarketingDistributionAgents,
  useCreateMarketingDistributionAgent,
  useUpdateMarketingDistributionAgent,
  useDeleteMarketingDistributionAgent,
  getListMarketingDistributionAgentsQueryKey,
  useListCompanies,
  type MarketingDistributionAgent,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function DistributionAgentsPage() {
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "userId", label: "Agent (User ID)", labelAr: "الوكيل (معرّف المستخدم)", required: true },
    { name: "weight", label: "Weight", labelAr: "الوزن", type: "number" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<MarketingDistributionAgent>[] = [
    { header: "Agent (User ID)", headerAr: "الوكيل (معرّف المستخدم)", render: (r) => <span className="font-medium">{r.userId}</span> },
    { header: "Weight", headerAr: "الوزن", render: (r) => r.weight },
  ];

  return (
    <ResourceManager
      title="Lead Distribution Agents"
      titleAr="وكلاء توزيع العملاء"
      columns={columns}
      fields={fields}
      useList={useListMarketingDistributionAgents}
      useCreate={useCreateMarketingDistributionAgent}
      useUpdate={useUpdateMarketingDistributionAgent}
      useDelete={useDeleteMarketingDistributionAgent}
      getListQueryKey={getListMarketingDistributionAgentsQueryKey}
      companyId={companyId}
    />
  );
}
