import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { 
  useListCurrencies, 
  useCreateCurrency, 
  useUpdateCurrency, 
  useDeleteCurrency,
  getListCurrenciesQueryKey,
  CurrencyInput,
  Currency
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function CurrenciesPage() {
  const { t } = useLanguage();
  const { data: currencies, isLoading } = useListCurrencies();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteCurrency();

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this currency?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Currency deleted" });
            queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey() });
          },
          onError: () => {
            toast({ title: "Failed to delete currency", variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("currencies.title")}</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("currencies.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("currencies.create")}</DialogTitle>
            </DialogHeader>
            <CurrencyForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Base</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Loading...</TableCell>
              </TableRow>
            ) : currencies?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">No currencies found</TableCell>
              </TableRow>
            ) : (
              currencies?.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-bold">{currency.code}</TableCell>
                  <TableCell>{currency.name}</TableCell>
                  <TableCell>{currency.symbol}</TableCell>
                  <TableCell>
                    {currency.isBase && <Badge>Base</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingCurrency(currency)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!currency.isBase && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(currency.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingCurrency} onOpenChange={(open) => !open && setEditingCurrency(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Currency</DialogTitle>
          </DialogHeader>
          {editingCurrency && (
            <CurrencyForm 
              currency={editingCurrency} 
              onSuccess={() => setEditingCurrency(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CurrencyForm({ currency, onSuccess }: { currency?: Currency; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCurrency();
  const updateMutation = useUpdateCurrency();
  
  const [formData, setFormData] = useState({
    code: currency?.code || "",
    name: currency?.name || "",
    symbol: currency?.symbol || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currency) {
      updateMutation.mutate(
        { id: currency.id, data: { name: formData.name, symbol: formData.symbol } },
        {
          onSuccess: () => {
            toast({ title: "Currency updated" });
            queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey() });
            onSuccess();
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData as CurrencyInput },
        {
          onSuccess: () => {
            toast({ title: "Currency created" });
            queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey() });
            onSuccess();
          }
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Code (e.g. SAR)</Label>
        <Input 
          value={formData.code} 
          onChange={(e) => setFormData({...formData, code: e.target.value})} 
          required 
          disabled={!!currency}
        />
      </div>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => setFormData({...formData, name: e.target.value})} 
          required 
        />
      </div>
      <div className="space-y-2">
        <Label>Symbol</Label>
        <Input 
          value={formData.symbol} 
          onChange={(e) => setFormData({...formData, symbol: e.target.value})} 
          required 
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {currency ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
