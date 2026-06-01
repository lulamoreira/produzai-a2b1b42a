import React from "react";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const FinancialPage = () => {
  return (
    <div className="p-4 md:p-8 animate-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Financeiro</h1>
        <p className="text-muted-foreground">Visão geral de receitas, custos e lucro líquido.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              +12%
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Receita Bruta</p>
          <h3 className="text-2xl font-display font-bold text-foreground">R$ 0,00</h3>
        </div>

        <div className="bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              +5%
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Lucro Líquido</p>
          <h3 className="text-2xl font-display font-bold text-foreground">R$ 0,00</h3>
        </div>

        <div className="bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <span className="flex items-center text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
              <ArrowDownRight className="w-3 h-3 mr-1" />
              -2%
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Custos Totais</p>
          <h3 className="text-2xl font-display font-bold text-foreground">R$ 0,00</h3>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm min-h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground italic">Dados financeiros serão exibidos após as primeiras vendas.</p>
      </div>
    </div>
  );
};

export default FinancialPage;
