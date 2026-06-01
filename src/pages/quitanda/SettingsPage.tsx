import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { Q3DCostSettings } from "@/types/quitanda";

const settingsSchema = z.object({
  filament_price_per_kg: z.coerce.number().min(0),
  energy_cost_per_hour: z.coerce.number().min(0),
  packaging_cost: z.coerce.number().min(0),
  ml_commission_rate: z.coerce.number().min(0).max(100),
  shopee_commission_rate: z.coerce.number().min(0).max(100),
  desired_margin: z.coerce.number().min(0).max(100),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const SettingsPage = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["q3d_cost_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("q3d_cost_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as Q3DCostSettings;
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      filament_price_per_kg: 80,
      energy_cost_per_hour: 0.80,
      packaging_cost: 2,
      ml_commission_rate: 14,
      shopee_commission_rate: 18,
      desired_margin: 40,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        filament_price_per_kg: Number(settings.filament_price_per_kg),
        energy_cost_per_hour: Number(settings.energy_cost_per_hour),
        packaging_cost: Number(settings.packaging_cost),
        ml_commission_rate: Number(settings.ml_commission_rate),
        shopee_commission_rate: Number(settings.shopee_commission_rate),
        desired_margin: Number(settings.desired_margin),
      });
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const { error } = await supabase
        .from("q3d_cost_settings")
        .upsert({
          id: settings?.id,
          ...values,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["q3d_cost_settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar configurações.");
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    mutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as taxas e custos base para cálculos de preço.</p>
      </div>

      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Custos de Produção</CardTitle>
                <CardDescription>Valores referentes à fabricação das peças.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="filament_price_per_kg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço do Filamento (kg)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <Input className="pl-9" type="number" step="0.01" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="energy_cost_per_hour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custo de Energia (hora)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <Input className="pl-9" type="number" step="0.01" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="packaging_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custo Médio de Embalagem</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input className="pl-9" type="number" step="0.01" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>Valor fixo por pedido/peça.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Taxas e Margens</CardTitle>
                <CardDescription>Comissões de marketplaces e rentabilidade desejada.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ml_commission_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comissão Mercado Livre</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                            <Input className="pr-8" type="number" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shopee_commission_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comissão Shopee</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                            <Input className="pr-8" type="number" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="desired_margin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Margem de Lucro Desejada</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                          <Input className="pr-8" type="number" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>Margem mínima após custos e taxas.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button 
                type="submit" 
                className="w-full md:w-auto px-8" 
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar configurações
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default SettingsPage;
