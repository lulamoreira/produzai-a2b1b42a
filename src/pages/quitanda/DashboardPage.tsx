import React from "react";

const DashboardPage = () => {
  return (
    <div className="p-4 md:p-8 animate-in">
      <h1 className="text-3xl font-display font-bold text-foreground mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Placeholder for KPI cards */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm h-32 animate-pulse" />
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
