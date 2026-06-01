import React from "react";
import { 
  Package, 
  TrendingUp, 
  ShoppingCart, 
  AlertCircle,
  ArrowUpRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StatCard = ({ title, value, icon: Icon, description, trend }: any) => (
  <div className="bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 rounded-[12px] bg-primary/5 flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      {trend && (
        <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <ArrowUpRight className="w-3 h-3 mr-1" />
          {trend}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <h3 className="text-3xl font-display font-bold text-foreground">{value}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

const DashboardPage = () => {
  const { data: stats } = useQuery({
    queryKey: ["q3d_dashboard_stats"],
    queryFn: async () => {
      const { count: dropsCount } = await supabase.from("q3d_drops").select("*", { count: 'exact', head: true });
      const { count: piecesCount } = await supabase.from("q3d_pieces").select("*", { count: 'exact', head: true });
      const { count: pendingCount } = await supabase.from("q3d_pieces").select("*", { count: 'exact', head: true }).eq("status", "pendente");
      
      return {
        dropsCount: dropsCount || 0,
        piecesCount: piecesCount || 0,
        pendingCount: pendingCount || 0,
      };
    }
  });

  return (
    <div className="p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Bem-vindo à Quitanda3dSHOP</h1>
        <p className="text-muted-foreground">Aqui está o que está acontecendo na sua loja de impressão 3D hoje.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total de Drops" 
          value={stats?.dropsCount || 0} 
          icon={Package}
          description="Drops cadastrados"
        />
        <StatCard 
          title="Peças Totais" 
          value={stats?.piecesCount || 0} 
          icon={ShoppingCart}
          description="Catálogo de peças"
        />
        <StatCard 
          title="Peças Pendentes" 
          value={stats?.pendingCount || 0} 
          icon={AlertCircle}
          description="Aguardando publicação"
          trend={stats?.pendingCount ? `${Math.round((stats.pendingCount / (stats.piecesCount || 1)) * 100)}%` : null}
        />
        <StatCard 
          title="Receita (Mês)" 
          value="R$ 0,00" 
          icon={TrendingUp}
          description="Vendas acumuladas"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[16px] border border-[#E5E7EB] shadow-sm min-h-[300px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-muted-foreground opacity-20" />
          </div>
          <h3 className="text-lg font-bold mb-2">Sem vendas recentes</h3>
          <p className="text-muted-foreground max-w-xs">
            As estatísticas de vendas e gráficos aparecerão aqui assim que você começar a vender.
          </p>
        </div>

        <div className="bg-white p-8 rounded-[16px] border border-[#E5E7EB] shadow-sm min-h-[300px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-primary opacity-40" />
          </div>
          <h3 className="text-lg font-bold mb-2">Ações Sugeridas</h3>
          <p className="text-muted-foreground max-w-xs mb-6">
            Publique as peças pendentes para começar a vender nos marketplaces.
          </p>
          <button className="text-primary font-bold text-sm hover:underline">
            Ir para Drops →
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
